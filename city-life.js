(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./city-stories.js") : root.PalmCityStories);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityLife = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Stories) {
  "use strict";

  const STEP = 48;
  const people = [
    { name: "小林", color: "#b87053", hobby: "喜欢刚出炉的面包", thought: "今天的风，闻起来像烤面包。", purchase: "正在买面包" },
    { name: "阿禾", color: "#688d74", hobby: "爱散步，也爱照顾花草", thought: "等会儿回家，给窗边的花浇点水。", purchase: "正在挑选鲜花" },
    { name: "米粒", color: "#c39b4f", hobby: "总能发现生活里的小事", thought: "把平常的一天，也过得亮晶晶。", purchase: "正在买一瓶牛奶" },
    { name: "小满", color: "#8196ae", hobby: "喜欢收集沿途的故事", thought: "今天也没有什么非赶不可的路。", purchase: "正在挑一本书" },
    { name: "阿岚", color: "#9d829b", hobby: "喜欢看云，喜欢热茶", thought: "带一杯热茶，慢慢走回家。", purchase: "正在买一包茶叶" },
  ];

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const neighbors = (a, b) => (Math.abs(a.x - b.x) <= 4 && Math.abs(Math.abs(a.y - b.y) - STEP) <= 4)
    || (Math.abs(a.y - b.y) <= 4 && Math.abs(Math.abs(a.x - b.x) - STEP) <= 4);

  function entrances(building, roads) {
    return roads.filter((road) => {
      const dx = Math.abs(road.x - building.x);
      const dy = Math.abs(road.y - building.y);
      return (dx <= 18 && dy >= 32 && dy <= 76) || (dy <= 18 && dx >= 32 && dx <= 76);
    }).sort((a, b) => distance(a, building) - distance(b, building));
  }

  function doorPoint(building, road) {
    const dx = road.x - building.x;
    const dy = road.y - building.y;
    return Math.abs(dx) > Math.abs(dy)
      ? { x: building.x + Math.sign(dx) * 29, y: building.y + 10 }
      : { x: building.x, y: building.y + Math.sign(dy) * 28 };
  }

  function createNetwork(items) {
    const roads = items.filter((item) => item.type === "road");
    const graph = new Map(roads.map((road) => [road.id, roads.filter((candidate) => candidate.id !== road.id && neighbors(road, candidate))]));
    return { roads, graph };
  }

  function findRoute(home, shops, network, startRoads = null) {
    if (!home) return null;
    const starts = startRoads || entrances(home, network.roads);
    const goals = new Map();
    for (const shop of shops) for (const road of entrances(shop, network.roads)) {
      if (!goals.has(road.id)) goals.set(road.id, shop);
    }
    const queue = [...starts];
    const previous = new Map(starts.map((road) => [road.id, null]));
    const byId = new Map(network.roads.map((road) => [road.id, road]));
    for (let index = 0; index < queue.length; index++) {
      const road = queue[index];
      if (goals.has(road.id)) {
        const route = [];
        for (let id = road.id; id !== null; id = previous.get(id)) route.unshift(byId.get(id));
        const shop = goals.get(road.id);
        return { shopId: shop.id, points: [doorPoint(home, route[0]), ...route.map((node) => ({ x: node.x, y: node.y, roadId: node.id })), doorPoint(shop, road)] };
      }
      for (const next of network.graph.get(road.id) || []) {
        if (!previous.has(next.id)) { previous.set(next.id, road.id); queue.push(next); }
      }
    }
    return null;
  }

  const wishTypes = [
    { kind: "shade", title: "树下的长椅", quote: "想在树荫下，坐着听一会儿风。", symbol: "♧", thanks: "这里真凉快，谢谢你。" },
    { kind: "meeting", title: "街角见个面", quote: "要是有个小广场，就能和邻居聊聊天了。", symbol: "✳", thanks: "原来你也喜欢这里！" },
    { kind: "lamplight", title: "留一盏晚归的灯", quote: "想在亮着灯的长椅旁，看看晚上的小城。", symbol: "☾", thanks: "有灯陪着，晚风也温柔。" },
  ];

  function cleanProgress(value = {}) {
    if (!value || typeof value !== "object") value = {};
    const clean = (list) => [...new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string" && /^(shade|meeting|lamplight):\d+$/.test(id)).slice(0, 300) : [])];
    const identities = Array.isArray(value.identities) ? value.identities.filter((entry) => entry && Number.isFinite(entry.homeId) && Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < people.length).slice(0, 5).map((entry) => ({ homeId: entry.homeId, slot: entry.slot })) : [];
    return { accepted: clean(value.accepted), completed: clean(value.completed), identities, stories: Stories.cleanProgress(value.stories) };
  }

  function createSimulation(savedProgress = {}) {
    let residents = [];
    let layoutKey = "";
    let geometryKey = "";
    let elapsed = 0;
    let layout = [];
    let network = createNetwork([]);
    let night = false;
    let raining = false;
    let storySeason = "spring";
    let storyGardens = [];
    let storyContextKey = "";
    let progress = cleanProgress(savedProgress);
    let events = [];
    let reservedFacilities = new Set();
    const recorded = new Set();
    const greetings = new Map();

    function wishFor(resident) {
      const type = wishTypes[resident.slot % 3];
      return { ...type, id: `${type.kind}:${resident.homeId}`, residentId: resident.id, name: resident.name, color: resident.color };
    }

    function nearby(item, type, radius) {
      return layout.some((candidate) => candidate.type === type && distance(candidate, item) <= radius);
    }

    function publicRoute(home, targets, kind, wishId = null) {
      const route = findRoute(home, targets, network);
      if (!route) return null;
      const target = targets.find((item) => item.id === route.shopId);
      const angle = (target.rotate || 0) * Math.PI / 180;
      route.points[route.points.length - 1] = { x: target.x - Math.sin(angle) * 7, y: target.y + Math.cos(angle) * 7 };
      return { ...route, kind, targetId: target.id, wishId };
    }

    function preparation(resident) {
      const wish = wishFor(resident);
      const benches = layout.filter((item) => item.type === "bench");
      let targets;
      let conditions;
      if (wish.kind === "shade") {
        targets = benches.filter((item) => nearby(item, "tree", 105));
        conditions = [{ label: "一张长椅", done: benches.length > 0 }, { label: "树在长椅旁（约两格内）", done: targets.length > 0 }];
      } else if (wish.kind === "lamplight") {
        targets = benches.filter((item) => nearby(item, "lamp", 100));
        conditions = [{ label: "长椅旁有路灯（约两格内）", done: targets.length > 0 }];
      } else {
        targets = layout.filter((item) => item.type === "plaza");
        conditions = [{ label: "一座小广场", done: targets.length > 0 }];
      }
      let plan = publicRoute(resident.home, targets, wish.kind, wish.id);
      let partner = null;
      if (wish.kind === "meeting") {
        // Both neighbors must be able to reach the same square.
        plan = null;
        for (const target of targets) {
          const leaderRoute = publicRoute(resident.home, [target], wish.kind, wish.id);
          if (!leaderRoute) continue;
          partner = residents.find((other) => other.id !== resident.id && publicRoute(other.home, [target], wish.kind));
          if (partner) { plan = leaderRoute; break; }
        }
        conditions.push({ label: "两位邻居的家都接通广场", done: !!plan });
      } else conditions.push({ label: "从家门口沿小路走得到", done: !!plan });
      if (wish.kind === "lamplight") conditions.push({ label: "等夜幕降临，也可切换夜晚", done: night });
      if (raining) conditions.push({ label: "等雨停，再慢慢出门", done: false });
      return { ...wish, conditions, plan, partner, ready: conditions.every((condition) => condition.done) };
    }

    function wishes() {
      return residents.slice(0, 3).map((resident) => {
        const wish = preparation(resident);
        const completed = progress.completed.includes(wish.id);
        const accepted = progress.accepted.includes(wish.id);
        const visiting = resident.plan?.wishId === wish.id && ["outbound", "resting", "meeting"].includes(resident.phase);
        return { ...wish, status: completed ? "completed" : !accepted ? "available" : visiting ? "visiting" : wish.ready ? "ready" : "preparing" };
      });
    }

    function acceptWish(id) {
      if (!wishes().some((wish) => wish.id === id) || progress.accepted.includes(id)) return false;
      progress.accepted.push(id);
      layoutKey = "";
      sync(layout);
      return true;
    }

    function story() {
      const chapter = Stories.prepare(storySeason, layout, storyGardens, night);
      const saved = progress.stories.find(entry => entry.season === storySeason);
      const resident = residents.find(person => person.homeId === saved?.homeId)
        || residents.find(person => person.slot === chapter.slot) || residents[0];
      const plan = resident && publicRoute(resident.home, chapter.targets, "story");
      if (plan) {
        plan.storyId = storySeason;
        if (storySeason === "spring") plan.points[plan.points.length - 1].y += 15;
      }
      const conditions = [...chapter.conditions, { label: "从邻居家沿小路走得到", done: !!plan }];
      if (raining) conditions.push({ label: "等雨停，再一起出门", done: false });
      const ready = !!resident && conditions.every(condition => condition.done);
      const visiting = resident?.plan?.storyId === storySeason && ["outbound", "resting"].includes(resident.phase);
      return { ...chapter, residentId: resident?.id, name: resident?.name, homeId: resident?.homeId, conditions, plan, ready,
        status: saved?.completed ? "completed" : !saved ? "available" : visiting ? "visiting" : ready ? "ready" : "preparing" };
    }

    function acceptStory() {
      const current = story();
      if (!current.residentId || current.status !== "available") return false;
      progress.stories.push({ season: storySeason, homeId: current.homeId, completed: false });
      layoutKey = ""; sync(layout); return true;
    }

    function setStoryContext({ season = "spring", gardens = [] } = {}) {
      const next = Stories.valid(season) ? season : "spring";
      const key = next + "|" + gardens.filter(garden => garden.planted && garden.growth >= 1).map(garden => garden.id).sort((a, b) => a - b).join(",");
      storyGardens = gardens;
      if (key === storyContextKey) return;
      storySeason = next; storyContextKey = key; layoutKey = ""; sync(layout);
    }

    function emitStory(resident) {
      const entry = progress.stories.find(item => item.season === resident.plan.storyId);
      const current = story();
      if (!entry || entry.completed || !current.ready || current.season !== entry.season || current.residentId !== resident.id) return;
      entry.completed = true; entry.homeId = resident.homeId;
      resident.speech = current.thanks; resident.speechUntil = elapsed + 9;
      events.push({ id: `story:${entry.season}`, kind: "story", season: entry.season, title: current.title,
        text: `${current.label}，${resident.name}${current.action}。你布置的角落，成了邻居记得的一天。`, quote: current.thanks });
    }

    function setNight(value) {
      if (night === !!value) return;
      night = !!value;
      layoutKey = "";
      sync(layout);
    }

    function emitMemory(resident, kind, partner = null) {
      const wish = wishFor(resident);
      const isWish = resident.plan?.wishId === wish.id && progress.accepted.includes(wish.id) && !progress.completed.includes(wish.id);
      if (isWish) progress.completed.push(wish.id);
      const title = kind === "shade" ? "风在树下停了一会儿" : kind === "meeting" ? "街角的一声你好" : "为晚风留一盏灯";
      const text = kind === "shade" ? `今天，${resident.name}第一次在树下的长椅休息。` : kind === "meeting" ? `今天，${resident.name}和${partner.name}在小广场打了招呼。` : `今晚，${resident.name}在路灯旁坐了一会儿。`;
      const id = isWish ? `wish:${wish.id}` : `first:${kind}:${resident.homeId}`;
      if (!recorded.has(id)) {
        recorded.add(id);
        events.push({ id, wishId: isWish ? wish.id : null, kind, title, text, quote: wishTypes.find((type) => type.kind === kind).thanks });
      }
      resident.speech = wishTypes.find((type) => type.kind === kind).thanks;
      resident.speechUntil = elapsed + 7;
    }

    function atHome(resident, wait = 1) {
      resident.phase = "home";
      resident.visible = false;
      resident.x = resident.home.x;
      resident.y = resident.home.y + 28;
      resident.wait = wait;
      resident.route = [];
      resident.step = 0;
      resident.used = false;
      resident.speech = "";
      resident.rainPlan = null;
      resident.greetingUntil = 0;
      resident.carrying = false;
    }

    function routeFromHere(resident, targets) {
      // An interrupted walker can turn toward either end of the current road segment.
      const anchors = [resident.route?.[resident.step - 1], resident.route?.[resident.step]]
        .filter((point) => point?.roadId && network.roads.some((road) => road.id === point.roadId));
      if (!anchors.length) {
        const source = layout.find((item) => item.id === (resident.rainPlan?.targetId || resident.plan?.targetId || resident.plan?.shopId));
        if (source && distance(resident, source) < 80) anchors.push(...entrances(source, network.roads));
      }
      const routes = anchors.map((anchor) => {
        const road = network.roads.find((item) => item.id === anchor.roadId || item.id === anchor.id);
        const route = road && findRoute(resident, targets, network, [road]);
        if (!route) return null;
        route.points[0] = { x: resident.x, y: resident.y };
        route.length = route.points.slice(1).reduce((sum, point, index) => sum + distance(point, route.points[index]), 0);
        return route;
      }).filter(Boolean);
      return routes.sort((a, b) => a.length - b.length)[0] || null;
    }

    function respondToRain(resident, returning = false) {
      if (!resident.visible) { atHome(resident); resident.reason = "在家听一会儿雨"; return; }
      const home = routeFromHere(resident, [resident.home]);
      const shelter = returning ? null : routeFromHere(resident, layout.filter((item) => item.type === "pavilion"));
      const toShelter = shelter && (!home || shelter.length <= home.length * 1.8 + 80);
      const route = toShelter ? shelter : home;
      if (!route) { atHome(resident); return; }
      if (toShelter) {
        const target = layout.find((item) => item.id === route.shopId);
        route.points[route.points.length - 1] = { x: target.x + (resident.slot - 2) * 8, y: target.y + 10 };
      }
      resident.rainPlan = { targetId: route.shopId, shelter: !!toShelter };
      resident.phase = returning ? "rain-returning" : toShelter ? "rain-walk" : "rain-home";
      resident.route = route.points;
      resident.step = 1;
      resident.speech = returning ? "雨停了，空气真好。" : toShelter ? "去凉亭听一会儿雨。" : "回家泡一杯热茶。";
      resident.speechUntil = elapsed + 7;
    }

    function setWeather(kind) {
      const next = kind === "rain";
      if (next === raining) return;
      raining = next;
      for (const resident of residents) {
        if (raining) respondToRain(resident);
        else if (resident.rainPlan) respondToRain(resident, true);
      }
      layoutKey = "";
      sync(layout);
    }

    function sync(items) {
      layout = items;
      const relevant = items.filter((item) => ["house", "shop", "road", "tree", "bench", "lamp", "plaza", "pavilion", "garden"].includes(item.type));
      const key = relevant.map((item) => `${item.id}:${item.type}:${item.x}:${item.y}:${item.rotate || 0}`).join("|");
      if (key === layoutKey) return false;
      const geometryChanged = key !== geometryKey;
      geometryKey = key;
      layoutKey = key;
      const homes = items.filter((item) => item.type === "house").slice(0, 5);
      const shops = items.filter((item) => item.type === "shop");
      network = createNetwork(items);
      const previous = new Map(residents.map((resident) => [resident.homeId, resident]));
      const usedSlots = new Set(homes.map((home) => previous.get(home.id)?.slot).filter((slot) => slot !== undefined));
      const restoredSlots = new Map();
      for (const home of homes) {
        if (previous.has(home.id)) continue;
        const savedSlot = progress.identities.find((entry) => entry.homeId === home.id)?.slot;
        if (savedSlot !== undefined && !usedSlots.has(savedSlot)) { restoredSlots.set(home.id, savedSlot); usedSlots.add(savedSlot); }
      }
      residents = homes.map((home) => {
        let resident = previous.get(home.id);
        if (!resident) {
          const slot = restoredSlots.get(home.id) ?? people.findIndex((_, index) => !usedSlots.has(index));
          usedSlots.add(slot);
          resident = { ...people[slot], id: `resident-${home.id}`, homeId: home.id, slot, trips: 0, sway: 0 };
        }
        resident.home = { ...home };
        return resident;
      });
      progress.identities = residents.map((resident) => ({ homeId: resident.homeId, slot: resident.slot }));
      const assigned = new Map();
      for (const resident of residents.slice(0, 3)) {
        const wish = preparation(resident);
        if (!progress.accepted.includes(wish.id) || progress.completed.includes(wish.id) || !wish.ready) continue;
        if (wish.kind === "meeting") {
          assigned.set(resident.id, wish.plan);
          const target = layout.find((item) => item.id === wish.plan.targetId);
          const companion = publicRoute(wish.partner.home, [target], "meeting");
          // Separate seats give the two arrivals readable space to meet.
          wish.plan.points[wish.plan.points.length - 1].x -= 13;
          companion.points[companion.points.length - 1].x += 13;
          assigned.set(wish.partner.id, companion);
        } else if (!assigned.has(resident.id)) assigned.set(resident.id, wish.plan);
      }
      const chapter = story();
      if (chapter.ready && ["ready", "visiting"].includes(chapter.status) && !assigned.has(chapter.residentId)) assigned.set(chapter.residentId, chapter.plan);
      residents.forEach((resident) => {
        const home = resident.home;
        const oldHome = resident.previousHome;
        let plan = assigned.get(resident.id);
        // Let a completed story keep its thank-you and return trip until the neighbor gets home.
        if (!geometryChanged && resident.plan?.storyId === storySeason && progress.stories.some(entry => entry.season === storySeason && entry.completed)
          && ["outbound", "resting", "returning"].includes(resident.phase)) plan = resident.plan;
        if (!plan) {
          const leisure = publicRoute(home, layout.filter((item) => item.type === "bench" && nearby(item, "tree", 105)), "shade")
            || (night ? publicRoute(home, layout.filter((item) => item.type === "bench" && nearby(item, "lamp", 100)), "lamplight") : null);
          plan = (resident.trips % 2 === 1 ? leisure : null) || findRoute(home, shops, network) || leisure || null;
        }
        const unchanged = resident.home?.x === home.x && resident.home?.y === home.y
          && oldHome?.x === home.x && oldHome?.y === home.y && JSON.stringify(resident.plan) === JSON.stringify(plan);
        resident.previousHome = { ...home };
        resident.plan = plan;
        resident.reason = !shops.length ? "等小商店开张" : !plan ? "等门前的路接通" : "在家歇一会儿";
        // Time-of-day and wish updates should not interrupt a valid shelter journey.
        if (resident.rainPlan && !geometryChanged) return;
        // Replan from the front door when a route changes; never walk a stale, removed road.
        if (!unchanged || !resident.phase) atHome(resident, .8 + resident.slot * 1.6);
        if (raining) {
          resident.reason = "在家听一会儿雨";
          if (resident.visible) respondToRain(resident);
        }
        else if (resident.rainPlan && !unchanged) respondToRain(resident, true);
      });
      return true;
    }

    function startRoute(resident, returning) {
      if (!returning && reservedFacilities.has(resident.plan?.targetId)) {
        resident.wait = 1;
        return;
      }
      if (!returning && resident.plan.kind && resident.plan.kind !== "meeting"
        && residents.some((other) => other.id !== resident.id && other.plan?.targetId === resident.plan.targetId && ["outbound", "resting"].includes(other.phase))) {
        resident.wait = 1;
        return;
      }
      resident.phase = returning ? "returning" : "outbound";
      resident.route = returning ? [...resident.plan.points].reverse() : resident.plan.points;
      resident.step = 1;
      resident.x = resident.route[0].x;
      resident.y = resident.route[0].y;
      resident.visible = true;
    }

    function walk(resident, dt) {
      let remaining = dt * (35 + resident.slot * 2);
      while (remaining > 0 && resident.step < resident.route.length) {
        const target = resident.route[resident.step];
        const length = distance(resident, target);
        if (length <= remaining) {
          resident.x = target.x; resident.y = target.y;
          remaining -= length; resident.step++;
        } else {
          resident.x += (target.x - resident.x) / length * remaining;
          resident.y += (target.y - resident.y) / length * remaining;
          remaining = 0;
        }
      }
      resident.sway = Math.sin(elapsed * 11 + resident.slot) * 1.3;
      return resident.step === resident.route.length;
    }

    function greetNeighbors() {
      const walkers = residents.filter((resident) => ["outbound", "returning"].includes(resident.phase)
        && !resident.rainPlan && !(resident.greetingUntil > elapsed) && !(resident.speechUntil > elapsed));
      for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j];
        if (a.greetingUntil > elapsed || b.greetingUntil > elapsed || distance(a, b) > 28) continue;
        // Only greet on a real shared street segment, never through houses or across water.
        const segmentA = [a.route[a.step - 1]?.roadId, a.route[a.step]?.roadId];
        const segmentB = [b.route[b.step - 1]?.roadId, b.route[b.step]?.roadId];
        if (segmentA.some((id) => id == null) || segmentB.some((id) => id == null) || !segmentA.some((id) => segmentB.includes(id))) continue;
        const pair = [a.homeId, b.homeId].sort((x, y) => x - y).join(":");
        if (elapsed - (greetings.get(pair) ?? -30) < 24) continue;
        greetings.set(pair, elapsed);
        for (const [resident, neighbor] of [[a, b], [b, a]]) {
          resident.greetingUntil = elapsed + 1.8;
          resident.greetingSide = Math.sign(neighbor.x - resident.x) || (resident.homeId < neighbor.homeId ? 1 : -1);
          resident.speech = `你好呀，${neighbor.name}`;
          resident.speechUntil = elapsed + 2.5;
        }
      }
    }

    function moment(resident) {
      if (resident.greetingUntil > elapsed && !raining && !resident.rainPlan) return "greeting";
      if (resident.phase === "resting" && resident.plan?.storyId === "spring") return "watching";
      if (resident.phase === "resting" && resident.plan?.storyId === "winter") return "tea";
      if (resident.phase === "resting") return resident.slot % 2 ? "reading" : "tea";
      if (resident.phase === "shopping") return "shopping";
      if (resident.phase === "returning" && resident.carrying) return "carrying";
      return "walking";
    }

    function tick(seconds) {
      const dt = Math.max(0, Math.min(Number(seconds) || 0, .25));
      elapsed += dt;
      if (!raining) greetNeighbors();
      for (const resident of residents) {
        if (raining || resident.rainPlan) {
          if (resident.phase === "sheltered" || resident.phase === "home") continue;
          if (resident.rainPlan && walk(resident, dt)) {
            if (raining && resident.rainPlan.shelter) {
              resident.phase = "sheltered";
              resident.speech = "雨落在屋檐上，真好听。";
              resident.speechUntil = elapsed + 8;
            } else {
              atHome(resident, 1 + resident.slot);
              resident.reason = raining ? "在家听一会儿雨" : "雨停了，等会儿出门";
              if (!raining) layoutKey = "";
            }
          }
          continue;
        }
        if (resident.greetingUntil > elapsed) { resident.sway = 0; continue; }
        if (!resident.plan) continue;
        if (resident.phase === "resting" || resident.phase === "meeting") {
          resident.stay += dt;
          if (resident.phase === "meeting") {
            const partner = residents.find((other) => other.id !== resident.id && other.phase === "meeting" && other.plan?.targetId === resident.plan.targetId);
            if (!partner && !resident.used) continue;
            if (partner && !resident.used) {
              resident.speech = `你好呀，${partner.name}`;
              resident.speechUntil = elapsed + 1;
            }
            if (!resident.used && resident.stay >= 2 && partner.stay >= 2) {
              // The requester owns the memory even if the companion arrives first.
              const owner = resident.plan.wishId ? resident : partner.plan.wishId ? partner : resident;
              const other = owner === resident ? partner : resident;
              emitMemory(owner, "meeting", other);
              resident.used = true; partner.used = true;
              resident.wait = 7; partner.wait = 7;
            }
            if (!resident.used) continue;
          } else if (!resident.used && resident.stay >= 2) {
            if (resident.plan.kind === "story") emitStory(resident);
            else emitMemory(resident, resident.plan.kind);
            resident.used = true;
          }
          resident.wait -= dt;
          if (resident.wait <= 0) startRoute(resident, true);
          continue;
        }
        if (resident.phase === "home" || resident.phase === "shopping") {
          resident.wait -= dt;
          if (resident.wait <= 0) startRoute(resident, resident.phase === "shopping");
          continue;
        }
        if (walk(resident, dt)) {
          if (resident.phase === "outbound") {
            resident.phase = resident.plan.kind === "meeting" ? "meeting" : resident.plan.kind ? "resting" : "shopping";
            resident.wait = resident.plan.kind ? 10 : 3.5 + resident.slot;
            resident.stay = 0;
            resident.used = false;
            if (!resident.plan.kind) resident.carrying = true;
            resident.speech = resident.plan.kind === "story" ? Stories.chapters[resident.plan.storyId].arrival : resident.plan.kind === "shade" ? "这里真凉快" : resident.plan.kind === "lamplight" ? "晚风和灯光，真好" : "";
            resident.speechUntil = elapsed + 5;
          } else {
            resident.trips++; atHome(resident, 5 + resident.slot * 2);
            // Start a fresh outing after a completed wish, without changing a trip in progress.
            layoutKey = "";
          }
        }
      }
      if (!layoutKey) sync(layout);
    }

    function activity(resident) {
      if (resident.phase === "rain-walk") return "撑伞沿小路去凉亭";
      if (resident.phase === "rain-home") return "撑伞慢慢走回家";
      if (resident.phase === "rain-returning") return "雨停了，沿路回家收伞";
      if (resident.phase === "sheltered") return "在凉亭里听雨";
      if (raining && resident.phase === "home") return "在家听一会儿雨";
      if (moment(resident) === "greeting") return "停下脚步，向邻居招招手";
      if (resident.phase === "outbound") return resident.plan.kind === "story" ? `去${Stories.chapters[resident.plan.storyId].label}的约定` : resident.plan.kind === "meeting" ? "去小广场见邻居" : resident.plan.kind ? "沿着小路去长椅" : "沿着小路去商店";
      if (resident.phase === "resting") return resident.plan.kind === "story" ? Stories.chapters[resident.plan.storyId].action : `${resident.plan.kind === "shade" ? "在树荫下" : "在路灯旁"}${moment(resident) === "reading" ? "读一会儿书" : "喝一口热茶"}`;
      if (resident.phase === "meeting") return resident.used ? "和邻居聊聊天" : "在小广场等邻居";
      if (resident.phase === "shopping") return resident.purchase;
      if (resident.phase === "returning") return "带着好心情回家";
      return resident.reason;
    }

    return {
      sync, tick, activity, moment, wishes, acceptWish, setNight, setWeather, story, acceptStory, setStoryContext,
      setReservedFacilities(ids) { reservedFacilities = new Set(ids); },
      progress: () => cleanProgress(progress),
      restoreProgress(value) { progress = cleanProgress(value); layoutKey = ""; },
      drainEvents() { const pending = events; events = []; return pending; },
      speech: (resident) => resident.speechUntil > elapsed ? resident.speech : "",
      get residents() { return residents; },
    };
  }

  return { createSimulation, createNetwork, findRoute, entrances, doorPoint, cleanProgress };
});
