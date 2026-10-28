(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./city-life.js") : root.PalmCityLife);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityVisitors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Life) {
  "use strict";
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const same = (a, b) => a && b && distance(a, b) < .1;
  const moving = new Set(["walking", "returning", "rain-walk"]);
  const phases = new Set(["arriving", "walking", "returning", "admiring", "photographing", "resting", "rain-walk", "sheltered", "waiting", "leaving"]);
  const copy = (value) => JSON.parse(JSON.stringify(value));

  function createSimulation(saved) {
    let layout = [], network = Life.createNetwork([]), key = "";
    let weather = "sunny", gardens = {}, occupied = new Set();
    let active = null, count = 0, events = [];

    function sitePoint(item, road) {
      if (item.type === "bench") {
        const angle = (item.rotate || 0) * Math.PI / 180;
        return { x: item.x - Math.sin(angle) * 7, y: item.y + Math.cos(angle) * 7, site: { ...item } };
      }
      if (item.type === "pavilion") return { x: item.x, y: item.y + 9, site: { ...item } };
      return { ...Life.doorPoint(item, road), site: { ...item } };
    }

    function preparation() {
      const docks = layout.filter((item) => item.type === "dock");
      const dock = docks.find((item) => Life.entrances(item, network.roads).length) || docks[0];
      const connected = !!dock && Life.entrances(dock, network.roads).length > 0;
      const hasRoute = (targets) => !!dock && !!Life.findRoute(dock, targets, network);
      const shaded = layout.filter((item) => item.type === "bench" && layout.some((tree) => tree.type === "tree" && distance(item, tree) <= 105));
      return { dock, ready: connected && !active, conditions: [
        { label: "一座接上小路的码头", done: connected, type: dock ? "road" : "dock" },
        { label: "沿路可到达的小花园", done: hasRoute(layout.filter((item) => item.type === "garden")), type: "garden" },
        { label: "沿路可到达的树下长椅", done: hasRoute(shaded), type: "bench" },
      ] };
    }

    function say(message) {
      active.speech = message;
      active.speechTime = 5;
      if (active.log[active.log.length - 1] !== message) active.log.push(message);
      active.log = active.log.slice(-12);
    }

    function invite() {
      const prep = preparation();
      if (!prep.ready) return false;
      const dock = prep.dock;
      const point = sitePoint(dock, Life.entrances(dock, network.roads)[0]);
      active = { id: `visit-${Date.now()}-${count + 1}`, name: "阿远", phase: "arriving", dockId: dock.id,
        x: point.x, y: point.y, site: { ...dock }, task: 0, visited: { garden: false, photo: false, rest: false },
        route: [], step: 0, goalId: null, goalKind: null, wait: 5, boatProgress: 0, boatDock: { ...dock },
        speech: "", speechTime: 0, log: [], rainSeen: weather === "rain", postcardIssued: false, sway: 0, retry: 0 };
      say("你好，想来看看这里的花。");
      return true;
    }

    // Find only road anchors physically connected to the walker's present segment.
    // A deleted tile can never become a shortcut to the other side of a gap.
    function anchors() {
      const a = active;
      const found = new Map();
      const add = (point) => {
        const road = point && network.roads.find((candidate) => same(candidate, point));
        if (road) found.set(road.id, road);
      };
      network.roads.forEach((road) => { if (distance(a, road) < .2) add(road); });
      for (const road of network.roads) {
        const aligned = Math.abs(road.x - a.x) < .2 || Math.abs(road.y - a.y) < .2;
        if (aligned && distance(a, road) <= 24.1) add(road);
        for (const neighbor of network.graph.get(road.id) || []) {
          if (Math.abs(distance(a, road) + distance(a, neighbor) - distance(road, neighbor)) < .2) {
            add(road); add(neighbor);
          }
        }
      }
      const before = a.route[a.step - 1], after = a.route[a.step];
      if (before && after) {
        const roadPoints = [before, after].filter((point) => point.roadId != null);
        if (roadPoints.length === 1 && [before, after].some((point) => point.site)
          && Math.abs(distance(a, before) + distance(a, after) - distance(before, after)) < .2) add(roadPoints[0]);
      }
      if (a.site) {
        // The entrance remains a way back onto the street if its facility moves.
        for (const road of Life.entrances(a.site, network.roads)) add(road);
      }
      return [...found.values()];
    }

    function routeTo(targets) {
      const routes = anchors().map((road) => {
        const route = Life.findRoute(active, targets, network, [road]);
        if (!route) return null;
        const target = targets.find((item) => item.id === route.shopId);
        const before = active.route[active.step - 1], after = active.route[active.step];
        const connector = active.site || ([before, after].find((point) => point?.site)?.site);
        route.points[0] = { x: active.x, y: active.y, ...(connector ? { site: { ...connector } } : {}) };
        route.points[route.points.length - 1] = sitePoint(target, route.points[route.points.length - 2]);
        route.length = route.points.slice(1).reduce((sum, point, index) => sum + distance(point, route.points[index]), 0);
        return route;
      }).filter(Boolean);
      return routes.sort((a, b) => a.length - b.length)[0] || null;
    }

    function waiting(message) {
      active.phase = "waiting";
      active.retry = 1;
      if (active.speech !== message) say(message);
    }

    function go(targets, kind) {
      const route = routeTo(targets);
      if (!route) return false;
      active.route = route.points;
      active.step = 1;
      active.goalId = route.shopId;
      active.goalKind = kind;
      active.phase = kind === "dock" ? "returning" : kind === "shelter" ? "rain-walk" : "walking";
      active.site = null;
      return true;
    }

    function plan() {
      if (!active || ["arriving", "leaving"].includes(active.phase)) return;
      if (weather === "rain") {
        active.rainSeen = true;
        if (active.site?.type === "pavilion" && layout.some((item) => item.id === active.site.id && same(item, active.site))) {
          active.phase = "sheltered";
          return;
        }
        if (go(layout.filter((item) => item.type === "pavilion"), "shelter")) { say("先借一处屋檐，听听雨。"); return; }
        waiting("撑着伞，等雨停了再走。");
        return;
      }
      if (active.task === 0) {
        if (go(layout.filter((item) => item.type === "garden"), "garden")) { say("沿着小路，去看看花园。"); return; }
        // A local broken road must be repaired before any new route can start.
        if (!anchors().length) { waiting("小路断了，我在这里等一等。"); return; }
        say("花园还没接通，下次再去看看。");
        active.task = 1;
      }
      if (active.task === 1) {
        const benches = layout.filter((item) => item.type === "bench" && !occupied.has(item.id)
          && layout.some((tree) => tree.type === "tree" && distance(tree, item) <= 105));
        if (go(benches, "bench")) { say("树下有张长椅，去坐一会儿。"); return; }
        if (!anchors().length) { waiting("小路断了，我在这里等一等。"); return; }
        say("长椅留给邻居，慢慢走回去吧。");
        active.task = 2;
      }
      const docks = layout.filter((item) => item.type === "dock");
      const original = docks.find((item) => item.id === active.dockId);
      if (go(original ? [original, ...docks.filter((item) => item !== original)] : docks, "dock")) { say("把风景装进口袋，回码头啦。"); return; }
      waiting(docks.length ? "回码头的小路断了，等它接好。" : "码头不见了，等一座新码头。");
    }

    function sync(items, context = {}) {
      const nextKey = items.map((item) => `${item.id}:${item.type}:${item.x}:${item.y}:${item.rotate || 0}`).join("|");
      const changed = nextKey !== key;
      if (changed) { layout = items.map((item) => ({ ...item })); network = Life.createNetwork(layout); key = nextKey; }
      const nextWeather = context.weather === "rain" ? "rain" : "sunny";
      const weatherChanged = nextWeather !== weather;
      weather = nextWeather;
      gardens = context.gardens || gardens;
      occupied = new Set(context.occupied || []);
      if (active && (changed || weatherChanged)) {
        if (active.phase === "arriving") {
          const dock = layout.find((item) => item.id === active.dockId && same(item, active.boatDock));
          if (!dock || !Life.entrances(dock, network.roads).length) cancel();
        } else if (active.phase !== "leaving") plan();
      }
    }

    function arrived() {
      const a = active;
      a.site = a.route[a.route.length - 1].site;
      if (a.goalKind === "dock") {
        a.phase = "leaving";
        a.boatProgress = 0;
        a.boatDock = { ...a.site };
        a.wait = 5;
        count++;
        a.postcardIssued = true;
        const quote = a.visited.photo ? "把花开的这一刻，带回远方。" : a.visited.garden && a.visited.rest ? "花园里走走，树荫下坐坐，就很好。" : a.visited.garden ? "花园还在慢慢长大，我也愿意慢慢等。" : a.visited.rest ? "树下的风很轻，坐着就舍不得走。" : "今天先认认路，下次再慢慢逛。";
        events.push({ kind: "postcard", id: a.id, number: count, name: a.name, visited: { ...a.visited }, rainSeen: a.rainSeen, quote, log: [...a.log] });
      } else if (a.goalKind === "shelter") { a.phase = "sheltered"; say("雨滴在屋檐上，也很好听。"); }
      else if (a.goalKind === "garden") {
        a.phase = "admiring"; a.wait = 4;
        say(gardens[a.goalId]?.stage === "bloom" ? "花开得真好，想拍一张。" : "这块小花园，藏着慢慢长大的春天。");
      } else {
        if (occupied.has(a.goalId)) { plan(); return; }
        a.phase = "resting"; a.wait = 5;
        say("树荫下的风，让人舍不得走。");
      }
    }

    function tick(seconds) {
      if (!active || !Number.isFinite(seconds) || seconds <= 0) return;
      const dt = Math.min(seconds, .25), a = active;
      a.speechTime = Math.max(0, a.speechTime - dt);
      a.sway = Math.sin((a.swayClock = (a.swayClock || 0) + dt) * 11) * 1.2;
      if (a.phase === "arriving" || a.phase === "leaving") {
        a.wait -= dt;
        a.boatProgress = Math.min(1, 1 - a.wait / 5);
        if (a.wait <= 0) {
          if (a.phase === "leaving") { active = null; events.push({ kind: "departed" }); }
          else { a.phase = "waiting"; plan(); }
        }
        return;
      }
      if (a.phase === "waiting") { a.retry -= dt; if (a.retry <= 0) { a.retry = 1; plan(); } return; }
      if (a.phase === "sheltered") return;
      if (moving.has(a.phase)) {
        let remaining = dt * 42;
        while (remaining > 0 && a.step < a.route.length) {
          const point = a.route[a.step], length = distance(a, point);
          if (length <= remaining) { a.x = point.x; a.y = point.y; remaining -= length; a.step++; }
          else { a.x += (point.x - a.x) / length * remaining; a.y += (point.y - a.y) / length * remaining; remaining = 0; }
        }
        if (a.step === a.route.length) arrived();
        return;
      }
      a.wait -= dt;
      if (a.wait > 0) return;
      if (a.phase === "admiring") {
        a.visited.garden = true;
        if (gardens[a.goalId]?.stage === "bloom") { a.phase = "photographing"; a.wait = 2; say("咔嚓，把花开留在相机里。"); return; }
        a.task = 1;
      } else if (a.phase === "photographing") { a.visited.photo = true; a.task = 1; }
      else if (a.phase === "resting") { a.visited.rest = true; a.task = 2; }
      plan();
    }

    function cancel() {
      if (!active || active.phase === "leaving") return false;
      active = null;
      events.push({ kind: "cancelled" });
      return true;
    }

    function restore(value) {
      count = Math.max(0, Math.min(1000000, Math.floor(Number(value?.count) || 0)));
      active = null;
      events = [];
      const a = value?.active;
      if (!a || !phases.has(a.phase) || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !a.boatDock || !Array.isArray(a.route)) return;
      const pointValid = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 1500 && Math.abs(point.y) < 1000;
      if (!pointValid(a) || !pointValid(a.boatDock) || !a.route.every(pointValid) || a.route.length > 500) return;
      active = copy(a);
      active.name = "阿远";
      active.id = typeof a.id === "string" ? a.id.slice(0, 100) : `visit-${Date.now()}`;
      active.task = Math.max(0, Math.min(2, Math.floor(a.task) || 0));
      active.step = Math.max(0, Math.min(a.route.length, Math.floor(a.step) || 0));
      active.visited = { garden: a.visited?.garden === true, photo: a.visited?.photo === true, rest: a.visited?.rest === true };
      active.log = Array.isArray(a.log) ? a.log.filter((line) => typeof line === "string").slice(-12).map((line) => line.slice(0, 80)) : [];
      active.wait = Math.max(0, Math.min(5, Number(a.wait) || 0));
      active.boatProgress = Math.max(0, Math.min(1, Number(a.boatProgress) || 0));
      active.speech = typeof a.speech === "string" ? a.speech.slice(0, 80) : "";
      active.speechTime = 0;
      active.retry = 0;
      key = "";
    }

    function activity() {
      const a = active;
      if (!a) return "花草旅人 · 喜欢花园、树荫和慢慢走";
      return ({ arriving: "小船正载着阿远靠岸", walking: a.goalKind === "garden" ? "沿着小路去花园" : "沿着小路去树下长椅", returning: "沿着小路返回码头", admiring: "在花园旁驻足赏花", photographing: "正在拍下花开的样子", resting: "坐在树下听一会儿风", "rain-walk": "撑伞沿路去凉亭", sheltered: "在凉亭听雨，雨停继续逛", waiting: a.speech, leaving: "阿远乘船离开，带走一城风景" })[a.phase];
    }

    restore(saved);
    return { sync, invite, tick, preparation, activity, cancel, restore,
      save: () => ({ count, active: active ? copy(active) : null }),
      drainEvents() { const pending = events; events = []; return pending; },
      reservedIds: () => active?.goalKind === "bench" && ["walking", "resting"].includes(active.phase) ? [active.goalId] : [],
      get active() { return active; }, get count() { return count; },
    };
  }
  return { createSimulation };
});
