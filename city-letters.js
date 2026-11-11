(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./city-life.js") : root.PalmCityLife);
  if (common) module.exports = api;
  else root.PalmCityLetters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Life) {
  "use strict";

  const VERSION = 1;
  const HISTORY_LIMIT = 60;
  const STATUSES = new Set(["offered", "accepted", "prepared", "travelling", "completed"]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const dayValue = (value) => Math.max(1, Math.min(100000, Math.floor(Number(value) || 1)));

  const templates = [
    {
      kind: "shelter",
      symbol: "☂",
      kicker: "A LETTER BEFORE THE RAIN",
      title: "雨落下来之前",
      letter: (name) => `云压得低低的。${name}把一封短信压在门缝里：今晚会下雨，想找一个能停一停的地方。`,
      quote: "不用走很远。只要前面有一处屋檐，回家的路就会容易一点。",
      options: [
        {
          id: "rain-pavilion",
          targetType: "pavilion",
          title: "留一处能听雨的屋檐",
          label: "建一座凉亭",
          description: "邻居会沿小路走进凉亭，等雨慢慢变轻。",
          effect: "凉亭会成为雨天可停留的公共角落。",
          tradeoff: "这里能避雨，但夜里仍缺一盏照路的灯。",
          resultTitle: "一场雨，有了屋檐",
          resultText: (name) => `${name}沿小路走进新凉亭。雨落在屋顶上，这条原本匆忙的路第一次有了可以停下来的地方。`,
          echoTitle: "昨天的屋檐留住了雨声",
          echoText: (name) => `${name}路过时又抬头看了看凉亭：“还在这里。下雨的时候，我会想起它。”`,
        },
        {
          id: "rain-lamp",
          targetType: "lamp",
          title: "在雨里点亮一盏灯",
          label: "安放一盏路灯",
          description: "邻居会沿着被照亮的小路走到灯下。",
          effect: "这段路会在夜晚持续发光。",
          tradeoff: "路变亮了，却还没有能坐下等雨的屋檐。",
          resultTitle: "雨里有了一盏灯",
          resultText: (name) => `${name}踩着湿漉漉的小路走到灯下。光落在水洼里，晚归的人终于能看清前面的转角。`,
          echoTitle: "那盏灯昨晚没有熄",
          echoText: (name) => `${name}说：“有灯以后，我愿意多走一小段夜路。”`,
        },
      ],
    },
    {
      kind: "meeting",
      symbol: "✉",
      kicker: "AN INVITATION TO THE CORNER",
      title: "街角想见一面",
      letter: (name) => `${name}在信里画了两个小人。住得这么近，却总只在门口匆匆点头，想找个地方多说几句话。`,
      quote: "一张能坐下来的地方就好。热闹一点，或者只坐两个人，也可以。",
      options: [
        {
          id: "meet-plaza",
          targetType: "plaza",
          title: "让整条街都能坐下来",
          label: "建一座小广场",
          description: "把更多邻居请到同一个街角。",
          effect: "广场会成为小城持续的公共会面地标。",
          tradeoff: "这里会更热闹，安静的两个人也会经过更多目光。",
          resultTitle: "街角坐下了很多人",
          resultText: (name) => `${name}在小广场等到第一位邻居。原本只是一个地址的街角，变成了大家愿意停下来的地方。`,
          echoTitle: "广场上多了几句问候",
          echoText: (name) => `${name}笑着说：“以前见了面只会点头，现在会记得彼此的名字。”`,
        },
        {
          id: "meet-bench",
          targetType: "bench",
          title: "只给两个人留个位置",
          label: "安放一张长椅",
          description: "让这次见面更安静，也更近。",
          effect: "长椅会成为一条更亲密的日常路线终点。",
          tradeoff: "两个人的话能说得更久，却没有一处让整条街围坐。",
          resultTitle: "两个人的话，慢慢说完",
          resultText: (name) => `${name}和新朋友在长椅上坐到天色变浅。没有很多声音，但没有人急着先走。`,
          echoTitle: "长椅被悄悄挪正了一点",
          echoText: (name) => `${name}说：“有人会记得，我们约在这里。”`,
        },
      ],
    },
    {
      kind: "lamplight",
      symbol: "☾",
      kicker: "A LIGHT FOR THE LATE WALK",
      title: "晚一点回家",
      letter: (name) => `${name}最近回来得越来越晚。信纸上只有一小片被灯照亮的路，和一句没有说完的话。`,
      quote: "不是害怕黑。只是想知道，转角后面是不是还有人住着。",
      options: [
        {
          id: "night-lamp",
          targetType: "lamp",
          title: "把回家的路照亮",
          label: "安放一盏路灯",
          description: "让邻居沿一条真正被照亮的道路回家。",
          effect: "路灯会长期改变夜间可达的路线。",
          tradeoff: "路清楚了，但小城仍缺一处能避风停下的地方。",
          resultTitle: "晚归的人看见了光",
          resultText: (name) => `${name}沿着灯走到路的尽头。光没有替人把路走完，却让每一步都更确定。`,
          echoTitle: "晚归时，那盏灯还亮着",
          echoText: (name) => `${name}说：“知道灯在那里，我就不必赶着回家。”`,
        },
        {
          id: "night-pavilion",
          targetType: "pavilion",
          title: "留一处能停下的屋檐",
          label: "建一座凉亭",
          description: "让晚归的人有理由在夜里多待一会儿。",
          effect: "凉亭会成为夜间可以停留的街角。",
          tradeoff: "亭子里能停，但来去的路仍少一盏明灯。",
          resultTitle: "夜色里多了一处屋檐",
          resultText: (name) => `${name}在凉亭里听了一会儿远处的声音，然后带着安静的夜色回家。`,
          echoTitle: "有人在凉亭里看过月亮",
          echoText: (name) => `${name}说：“那天我没有急着回去，小城也没有催我。”`,
        },
      ],
    },
    {
      kind: "bloom",
      symbol: "❀",
      kicker: "A LITTLE COLOUR FOR TOMORROW",
      title: "从花店回来的路",
      letter: (name) => `${name}带回来一包种子，却不知道应该把春天种在哪里。信纸边缘沾着一点花粉。`,
      quote: "不用一大片。只要明天经过的人，能看见一点颜色就好。",
      options: [
        {
          id: "bloom-flower",
          targetType: "flower",
          title: "先让街角亮起来",
          label: "安放一处花坛",
          description: "今天就能让经过的人看见颜色。",
          effect: "花坛会成为每天都能经过的一小片颜色。",
          tradeoff: "街角很快变好看，却还没有一块能亲手照料的花园。",
          resultTitle: "一封信变成了一小片颜色",
          resultText: (name) => `${name}蹲在花坛边看了很久。原本只是信里的一个念头，现在已经能让经过的人慢下脚步。`,
          echoTitle: "花坛边多了一串脚印",
          echoText: (name) => `${name}说：“有人绕远路来看花。原来一点颜色也能被记住。”`,
        },
        {
          id: "bloom-garden",
          targetType: "garden",
          title: "把明天慢慢种下来",
          label: "建一个小花园",
          description: "从种子开始照料一处会长大的角落。",
          effect: "小花园会成为可以持续照料、慢慢长大的地方。",
          tradeoff: "花园需要浇水等待，街边少了立刻就能看见的颜色。",
          resultTitle: "这座城开始照料一朵花",
          resultText: (name) => `${name}把第一颗种子埋进土里。这里今天还看不出什么，却已经有了想明天再来一次的理由。`,
          echoTitle: "那颗种子还没有发芽",
          echoText: (name) => `${name}说：“没关系的。会等待的东西，更像一个约定。”`,
        },
      ],
    },
    {
      kind: "memory",
      symbol: "⌁",
      kicker: "WHERE SHOULD TODAY STAY",
      title: "想把今天留下来",
      letter: (name) => `${name}说，今天没有什么大事，却很喜欢。这样的日子如果不留一个角落，好像很快就会忘记。`,
      quote: "以后经过的时候，能想起今天坐过、站过，或者只是来看了看吗？",
      options: [
        {
          id: "memory-bench",
          targetType: "bench",
          title: "留一个坐下来的位置",
          label: "安放一张长椅",
          description: "让今天变成一个随时能回去坐坐的地方。",
          effect: "这张长椅会成为下一次停留的固定记忆点。",
          tradeoff: "有了座位，却没有一棵会跟着日子长大的树。",
          resultTitle: "今天有了坐下来的地方",
          resultText: (name) => `${name}在长椅上坐到最后一片云变淡。很普通的一天，因为有了这个位置，变得可以重新回来。`,
          echoTitle: "长椅还记得昨天",
          echoText: (name) => `${name}说：“以后从这里经过，我会想起我们一起坐过。”`,
        },
        {
          id: "memory-tree",
          targetType: "tree",
          title: "给以后留一片树荫",
          label: "种下一棵树",
          description: "让今天长成以后会继续变化的东西。",
          effect: "树会长期留在小城，并随季节改变模样。",
          tradeoff: "树荫会慢慢长大，但今天还没有一张能坐下的椅子。",
          resultTitle: "给以后留下了一片树荫",
          resultText: (name) => `${name}在新树旁站了一会儿。它现在还不够高，却已经替很多个以后做好了准备。`,
          echoTitle: "新树比昨天高了一点",
          echoText: (name) => `${name}说：“等它的影子大一点，我们还来这里。”`,
        },
      ],
    },
  ];

  const templateByKind = new Map(templates.map((template) => [template.kind, template]));
  const optionByKey = new Map(templates.flatMap((template) => template.options.map((option) => [`${template.kind}:${option.id}`, option])));

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function residentList(context = {}) {
    const residents = typeof context.residents === "function" ? context.residents() : context.residents;
    return Array.isArray(residents) ? residents : [];
  }

  function publicOption(option) {
    return {
      id: option.id,
      targetType: option.targetType,
      title: option.title,
      label: option.label,
      description: option.description,
      effect: option.effect,
      tradeoff: option.tradeoff,
      resultTitle: option.resultTitle,
    };
  }

  function makeActive(context = {}, day = 1) {
    const residents = residentList(context).filter((resident) => resident?.home && typeof resident.id === "string");
    if (!residents.length) return null;
    const template = templates[(day - 1) % templates.length];
    const resident = residents[hash(`${day}:${template.kind}`) % residents.length];
    return {
      version: VERSION,
      id: `letter:${day}:${template.kind}:${resident.homeId}`,
      day,
      kind: template.kind,
      residentId: resident.id.slice(0, 80),
      residentName: text(resident.name, 20),
      homeId: resident.homeId,
      status: "offered",
      choiceId: null,
      choice: null,
      targetId: null,
      createdAt: Date.now(),
    };
  }

  function cleanActive(value) {
    if (!value || typeof value !== "object" || typeof value.id !== "string") return null;
    const template = templateByKind.get(value.kind);
    if (!template || !Number.isSafeInteger(value.homeId) || typeof value.residentId !== "string") return null;
    const status = STATUSES.has(value.status) ? value.status : "offered";
    const option = optionByKey.get(`${value.kind}:${value.choiceId}`) || null;
    if (status !== "offered" && !option) return null;
    const targetId = Number.isSafeInteger(value.targetId) ? value.targetId : null;
    const cleanStatus = ["prepared", "travelling", "completed"].includes(status) && !targetId ? "accepted" : status;
    const existingTargetIds = Array.isArray(value.existingTargetIds)
      ? [...new Set(value.existingTargetIds.filter(Number.isSafeInteger))].slice(0, 500)
      : [];
    return {
      version: VERSION,
      id: value.id.slice(0, 160),
      day: dayValue(value.day),
      kind: template.kind,
      residentId: value.residentId.slice(0, 80),
      residentName: text(value.residentName, 20),
      homeId: value.homeId,
      status: cleanStatus,
      choiceId: option?.id || null,
      choice: option ? publicOption(option) : null,
      targetId: option ? targetId : null,
      existingTargetIds: option ? existingTargetIds : [],
      createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    };
  }

  function cleanHistory(value) {
    const history = [];
    for (const entry of Array.isArray(value) ? value.slice(0, HISTORY_LIMIT * 2) : []) {
      if (!entry || typeof entry.id !== "string" || !templateByKind.has(entry.kind)) continue;
      const option = optionByKey.get(`${entry.kind}:${entry.choiceId}`);
      if (!option || !Number.isSafeInteger(entry.day) || !Number.isFinite(entry.createdAt)) continue;
      if (history.some((item) => item.id === entry.id)) continue;
      history.push({
        id: entry.id.slice(0, 160),
        day: dayValue(entry.day),
        kind: entry.kind,
        residentId: text(entry.residentId, 80),
        residentName: text(entry.residentName, 20),
        choiceId: option.id,
        choiceLabel: text(entry.choiceLabel, 40) || option.label,
        targetType: option.targetType,
        targetId: Number.isSafeInteger(entry.targetId) ? entry.targetId : null,
        title: text(entry.title, 60) || option.resultTitle,
        text: text(entry.text, 180),
        quote: text(entry.quote, 100),
        effect: text(entry.effect, 120) || option.effect,
        tradeoff: text(entry.tradeoff, 120) || option.tradeoff,
        echoTitle: text(entry.echoTitle, 60) || option.echoTitle,
        echoText: text(entry.echoText, 180) || option.echoText(entry.residentName || "邻居"),
        createdAt: entry.createdAt,
      });
    }
    return history.slice(0, HISTORY_LIMIT);
  }

  function createLetters(saved = {}) {
    let day = 1;
    let active = null;
    let history = [];

    function restore(value = {}) {
      const source = value && typeof value === "object" ? value : {};
      day = dayValue(source.day);
      active = cleanActive(source.active);
      history = cleanHistory(source.history);
    }

    function ensure(context = {}) {
      if (active) return active;
      active = makeActive(context, day);
      return active;
    }

    function current(context = {}) {
      ensure(context);
      return active ? clone(active) : null;
    }

    function template(context = {}) {
      const letter = current(context);
      return letter ? templateByKind.get(letter.kind) : null;
    }

    function options(context = {}) {
      const item = template(context);
      return item ? item.options.map(publicOption) : [];
    }

    function accept(choiceId, context = {}) {
      ensure(context);
      if (!active) return { ok: false, reason: "先让一位邻居住进小城，来信才会出现。" };
      if (active.status !== "offered") return { ok: false, reason: "今天已经回应过这封信。" };
      const option = optionByKey.get(`${active.kind}:${choiceId}`);
      if (!option) return { ok: false, reason: "没有找到这个回应。" };
      active.status = "accepted";
      active.choiceId = option.id;
      active.choice = publicOption(option);
      active.targetId = null;
      active.existingTargetIds = (Array.isArray(context.items) ? context.items : [])
        .filter((item) => item?.type === option.targetType && Number.isSafeInteger(item.id))
        .map((item) => item.id)
        .slice(0, 500);
      return { ok: true, active: clone(active), option: publicOption(option) };
    }

    function routeFor(letter, target, context = {}) {
      const resident = residentList(context).find((person) => person.id === letter?.residentId);
      const items = Array.isArray(context.items) ? context.items : [];
      if (!resident?.home || !target) return null;
      return Life.findRoute(resident.home, [target], Life.createNetwork(items));
    }

    function prepare(targetId, context = {}) {
      ensure(context);
      if (!active) return { ok: false, reason: "今天的来信还没有出现。" };
      if (!active.choice) return { ok: false, reason: "先选一个回应，再来准备街区。" };
      if (!["accepted", "prepared"].includes(active.status)) return { ok: false, reason: "现在不能更改出发准备。" };
      const items = Array.isArray(context.items) ? context.items : [];
      const target = items.find((item) => item.id === targetId && item.type === active.choice.targetType);
      if (!target) return { ok: false, reason: `先在岛上安放${active.choice.label.replace(/^(建|安放|种下)/, "")}。` };
      if (active.existingTargetIds.includes(target.id)) {
        return { ok: false, reason: "这封信需要一处新设施。请在岛上重新安放一件，再把它接上小路。" };
      }
      const route = routeFor(active, target, context);
      if (!route) return { ok: false, reason: "这件新布置还没有接上邻居走得到的小路。" };
      active.status = "prepared";
      active.targetId = target.id;
      return { ok: true, active: clone(active), target: { ...target }, route };
    }

    function depart(context = {}) {
      ensure(context);
      if (!active || active.status !== "prepared") return { ok: false, reason: "先把今天要用的角落准备好。" };
      const target = (Array.isArray(context.items) ? context.items : []).find((item) => item.id === active.targetId && item.type === active.choice?.targetType);
      if (!target || !routeFor(active, target, context)) {
        active.status = "accepted";
        active.targetId = null;
        return { ok: false, reason: "去往这里的路有了变化，先重新接好小路。" };
      }
      active.status = "travelling";
      return { ok: true, active: clone(active) };
    }

    function interrupt(reason = "") {
      if (!active || active.status === "completed") return false;
      active.status = active.choice ? "accepted" : "offered";
      active.targetId = null;
      active.interruptedReason = text(reason, 120);
      return true;
    }

    function complete(memory = {}) {
      if (!active || active.status !== "travelling" || !active.choice) return null;
      const option = optionByKey.get(`${active.kind}:${active.choiceId}`);
      if (!option) return null;
      const entry = {
        id: active.id,
        day: active.day,
        kind: active.kind,
        residentId: active.residentId,
        residentName: active.residentName,
        choiceId: active.choiceId,
        choiceLabel: option.label,
        targetType: option.targetType,
        targetId: active.targetId,
        title: text(memory.title, 60) || option.resultTitle,
        text: text(memory.text, 180) || option.resultText(active.residentName),
        quote: text(memory.quote, 100) || templateByKind.get(active.kind).quote,
        effect: option.effect,
        tradeoff: option.tradeoff,
        echoTitle: option.echoTitle,
        echoText: option.echoText(active.residentName),
        createdAt: Number.isFinite(memory.createdAt) ? memory.createdAt : Date.now(),
      };
      if (history.some((item) => item.id === entry.id)) return null;
      history = [entry, ...history].slice(0, HISTORY_LIMIT);
      active.status = "completed";
      return clone(entry);
    }

    function advance(context = {}) {
      if (!active || active.status !== "completed") return { ok: false, reason: "先让今天的邻居走到约定的地方。" };
      day += 1;
      active = null;
      ensure(context);
      return { ok: true, day, active: active ? clone(active) : null };
    }

    function echo(context = {}) {
      ensure(context);
      const previous = history.find((entry) => entry.day < day);
      return previous ? clone(previous) : null;
    }

    restore(saved);
    return {
      restore,
      ensure,
      current,
      template,
      options,
      accept,
      prepare,
      depart,
      interrupt,
      complete,
      advance,
      echo,
      history: () => clone(history),
      get day() { return day; },
      get active() { return clone(active); },
      save: () => ({ version: VERSION, day, active: clone(active), history: clone(history) }),
    };
  }

  return { VERSION, HISTORY_LIMIT, templates, createLetters };
});
