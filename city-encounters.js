(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./city-life.js") : root.PalmCityLife);
  if (common) module.exports = api;
  else root.PalmCityEncounters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Life) {
  "use strict";

  const VERSION = 1;
  const HISTORY_LIMIT = 60;
  const EVENT_KINDS = new Set(["rain", "sunny", "night"]);
  const CHOICE_IDS = new Set(["pavilion", "shop", "plaza", "shade-bench", "lit-bench"]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const near = (items, item, type, radius) => items.some((candidate) => candidate.type === type && distance(candidate, item) <= radius);

  const profiles = {
    rain: {
      kicker: "RAIN ON THE ROOFS",
      title: "雨落下来之前",
      label: "一场小雨",
      symbol: "☂",
      text: (name) => `云压低了，${name}刚好在街边。雨点越来越密，小城需要给这段路一个可以停下来的地方。`,
      quote: "“不用走很远，只要前面有一处能避雨就好。”",
      choices: [
        { id: "pavilion", target: "pavilion", label: "去凉亭听雨", note: "沿真实小路走进凉亭，等雨慢慢变轻。", missing: "还没有一座接通小路的凉亭。" },
        { id: "shop", target: "shop", label: "在商店门口等一等", note: "走到小商店，在檐下看雨水落过街角。", missing: "没有一间沿小路走得到的商店。" },
      ],
    },
    sunny: {
      kicker: "A WINDY LITTLE AFTERNOON",
      title: "风把街角吹得很轻",
      label: "晴天的一阵风",
      symbol: "☼",
      text: (name) => `天气很好，${name}却不想一直待在家里。城市里如果有一个坐得下来的地方，今天就会多一点停留。`,
      quote: "“我只是想在附近坐一会儿，看看谁会经过。”",
      choices: [
        { id: "plaza", target: "plaza", label: "去小广场坐坐", note: "让邻居沿小路去广场认识今天的街角。", missing: "还没有一座接通小路的小广场。" },
        { id: "shade-bench", target: "bench", shade: true, label: "去树荫下的长椅", note: "长椅旁边要有树，走到那里才算今天的休息。", missing: "还没有一张挨着树、并且接通小路的长椅。" },
        { id: "shop", target: "shop", label: "去商店逛一会儿", note: "沿小路慢慢走到商店，带一样小东西回家。", missing: "没有一间沿小路走得到的商店。" },
      ],
    },
    night: {
      kicker: "A LIGHT LEFT ON",
      title: "晚归的人想再走一会儿",
      label: "亮灯的夜晚",
      symbol: "☾",
      text: (name) => `街灯亮起来以后，${name}还想多走一小段。若有一盏灯照得到的长椅，今晚就不必急着回去。`,
      quote: "“有人留着一盏灯，回家的路就不算太晚。”",
      choices: [
        { id: "lit-bench", target: "bench", lamp: true, label: "去路灯旁坐一会儿", note: "长椅旁要有路灯，邻居会沿小路走到光里。", missing: "还没有一张靠近路灯、并且接通小路的长椅。" },
        { id: "pavilion", target: "pavilion", label: "去凉亭看夜色", note: "走到凉亭里，听一会儿晚风，再慢慢回家。", missing: "还没有一座接通小路的凉亭。" },
        { id: "shop", target: "shop", label: "去商店买一杯热的", note: "沿小路走到还开着的商店，再带着热气回家。", missing: "没有一间沿小路走得到的商店。" },
      ],
    },
  };

  function dayKey(value = new Date()) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function eventKind({ raining = false, night = false } = {}) {
    if (raining) return "rain";
    return night ? "night" : "sunny";
  }

  function matchingTargets(choice, items) {
    const targets = items.filter((item) => item.type === choice.target);
    if (choice.shade) return targets.filter((item) => near(items, item, "tree", 105));
    if (choice.lamp) return targets.filter((item) => near(items, item, "lamp", 100));
    return targets;
  }

  function residentList(context) {
    const residents = typeof context.residents === "function" ? context.residents() : context.residents;
    return Array.isArray(residents) ? residents : [];
  }

  function makeActive(kind, context, date) {
    const residents = residentList(context).filter((resident) => resident?.home && typeof resident.id === "string");
    if (!residents.length) return null;
    const resident = residents[hash(`${date}:${kind}`) % residents.length];
    return {
      version: VERSION,
      id: `scene:${date}:${kind}:${resident.homeId}`,
      date,
      kind,
      residentId: resident.id,
      residentName: text(resident.name, 20),
      homeId: resident.homeId,
      status: "offered",
      choiceId: null,
      targetId: null,
      choiceLabel: "",
      targetType: "",
      createdAt: Date.now(),
    };
  }

  function cleanHistory(value) {
    const list = [];
    for (const entry of Array.isArray(value) ? value.slice(0, HISTORY_LIMIT) : []) {
      if (!entry || typeof entry.id !== "string" || typeof entry.date !== "string"
        || !EVENT_KINDS.has(entry.kind) || !CHOICE_IDS.has(entry.choiceId)
        || !dayKey(entry.date) || !Number.isFinite(entry.createdAt)) continue;
      if (list.some((item) => item.id === entry.id)) continue;
      list.push({
        id: entry.id.slice(0, 160),
        date: dayKey(entry.date),
        kind: entry.kind,
        choiceId: entry.choiceId,
        choiceLabel: text(entry.choiceLabel, 40),
        targetType: text(entry.targetType, 20),
        residentId: text(entry.residentId, 80),
        residentName: text(entry.residentName, 20),
        title: text(entry.title, 60) || "小城的一幕",
        text: text(entry.text, 160),
        quote: text(entry.quote, 100),
        createdAt: entry.createdAt,
      });
    }
    return list;
  }

  function cleanActive(value) {
    if (!value || typeof value !== "object" || typeof value.id !== "string"
      || !EVENT_KINDS.has(value.kind) || !dayKey(value.date)
      || !["offered", "chosen"].includes(value.status)
      || !Number.isSafeInteger(value.homeId) || typeof value.residentId !== "string") return null;
    const choiceId = CHOICE_IDS.has(value.choiceId) ? value.choiceId : null;
    const targetId = Number.isSafeInteger(value.targetId) ? value.targetId : null;
    return {
      version: VERSION,
      id: value.id.slice(0, 160),
      date: dayKey(value.date),
      kind: value.kind,
      residentId: value.residentId.slice(0, 80),
      residentName: text(value.residentName, 20),
      homeId: value.homeId,
      status: value.status === "chosen" && choiceId && targetId ? "chosen" : "offered",
      choiceId: value.status === "chosen" ? choiceId : null,
      targetId: value.status === "chosen" ? targetId : null,
      choiceLabel: value.status === "chosen" ? text(value.choiceLabel, 40) : "",
      targetType: value.status === "chosen" ? text(value.targetType, 20) : "",
      createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    };
  }

  function createEncounters(saved = {}) {
    let active = null;
    let history = [];

    function restore(value = {}) {
      const source = value && typeof value === "object" ? value : {};
      active = cleanActive(source.active);
      history = cleanHistory(source.history);
      if (active && history.some((entry) => entry.id === active.id)) active = null;
    }

    function ensure(context = {}) {
      const date = dayKey(context.date);
      if (active?.date === date) return active;
      // A walk already accepted by the player finishes before a new day's scene appears.
      if (active?.status === "chosen") return active;
      if (history.some((entry) => entry.date === date)) { active = null; return null; }
      active = makeActive(eventKind(context), context, date);
      return active;
    }

    function current(context = {}) {
      ensure(context);
      return active ? clone(active) : null;
    }

    function options(context = {}) {
      ensure(context);
      if (!active) return [];
      const profile = profiles[active.kind];
      const resident = residentList(context).find((item) => item.id === active.residentId) || null;
      const items = Array.isArray(context.items) ? context.items : [];
      if (!resident?.home) return profile.choices.map((choice) => ({
        id: choice.id, label: choice.label, note: choice.note, available: false,
        reason: "邻居已经不在城里，这一幕要等下一次有人住进来。", targetId: null,
      }));
      const network = Life.createNetwork(items);
      return profile.choices.map((choice) => {
        const targets = matchingTargets(choice, items)
          .map((item) => ({ item, route: Life.findRoute(resident.home, [item], network) }))
          .filter((entry) => entry.route)
          .sort((a, b) => a.route.points.length - b.route.points.length || a.item.id - b.item.id);
        const found = targets[0];
        return {
          id: choice.id,
          label: choice.label,
          note: choice.note,
          targetId: found?.item.id ?? null,
          targetType: choice.target,
          available: !!found,
          reason: found ? "" : choice.missing,
        };
      });
    }

    function select(choiceId, context = {}) {
      ensure(context);
      if (!active) return { ok: false, reason: "这一幕已经结束，或还没有开始。" };
      if (active.status === "chosen") return { ok: false, reason: "已经选择过做法，正在等邻居走完这段路。" };
      const option = options(context).find((item) => item.id === choiceId);
      if (!option) return { ok: false, reason: "没有找到这个做法。" };
      if (!option.available) return { ok: false, reason: option.reason };
      active.status = "chosen";
      active.choiceId = option.id;
      active.targetId = option.targetId;
      active.choiceLabel = option.label;
      active.targetType = option.targetType;
      return { ok: true, active: clone(active), option: { ...option } };
    }

    function reopen() {
      if (!active || active.status !== "chosen") return false;
      active.status = "offered";
      active.choiceId = null;
      active.targetId = null;
      active.choiceLabel = "";
      active.targetType = "";
      return true;
    }

    function complete(memory = {}) {
      if (!active || active.status !== "chosen") return null;
      const targetType = active.targetType || "shop";
      const entry = {
        id: active.id,
        date: active.date,
        kind: active.kind,
        choiceId: active.choiceId,
        choiceLabel: active.choiceLabel,
        targetType,
        residentId: active.residentId,
        residentName: active.residentName,
        title: text(memory.title, 60) || profiles[active.kind].title,
        text: text(memory.text, 160) || `${active.residentName}沿小路完成了今天这一幕。`,
        quote: text(memory.quote, 100) || profiles[active.kind].quote.replace(/[“”]/g, ""),
        createdAt: Number.isFinite(memory.createdAt) ? memory.createdAt : Date.now(),
      };
      if (history.some((item) => item.id === entry.id)) return null;
      history = [entry, ...history].slice(0, HISTORY_LIMIT);
      active = null;
      return clone(entry);
    }

    function today(context = {}) {
      ensure(context);
      const date = dayKey(context.date);
      return active ? clone(active) : clone(history.find((entry) => entry.date === date) || null);
    }

    restore(saved);
    return {
      restore, ensure, current, options, select, reopen, complete, today,
      get active() { return clone(active); },
      history: () => clone(history),
      save: () => ({ version: VERSION, active: clone(active), history: clone(history) }),
    };
  }

  return { profiles, dayKey, eventKind, createEncounters, HISTORY_LIMIT };
});
