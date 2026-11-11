(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityIdentity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STEP = 48;
  const ORIGIN_Y = 12;
  const GRID_TOLERANCE = 4;
  const KNOWN_TYPES = new Set(["house", "shop", "tree", "road", "flower", "water", "bench", "lamp", "plaza", "pavilion", "garden", "dock"]);
  const CATEGORY_ORDER = ["residential", "commercial", "green", "waterside", "leisure"];
  const CATEGORIES = {
    residential: { label: "居住街区", symbol: "⌂", seal: "安居" },
    commercial: { label: "烟火街市", symbol: "▥", seal: "烟火" },
    green: { label: "花木绿廊", symbol: "⚘", seal: "花木" },
    waterside: { label: "水岸生活", symbol: "≈", seal: "水岸" },
    leisure: { label: "悠闲去处", symbol: "☷", seal: "闲庭" },
  };
  const TITLES = {
    residential: ["檐下人家", "晚灯小院", "慢巷归人", "窗边日光"],
    commercial: ["烟火小集", "晨光街市", "转角小店", "热闹檐廊"],
    green: ["青苔花园", "树影长街", "花木小巷", "风过绿廊"],
    waterside: ["枕水慢城", "河湾微光", "潮声小筑", "水色街角"],
    leisure: ["有闲小城", "晴光街角", "慢坐公园", "散步之城"],
  };
  const TRAITS = {
    residential: ["屋檐彼此照应", "回家的脚步很轻", "把日子过得安稳"],
    commercial: ["街角总有烟火", "来往的脚步很多", "出门就能遇见小店"],
    green: ["把小城种进花木里", "风从树荫经过", "每个转角都有颜色"],
    waterside: ["水面替天空留白", "沿水边慢慢走", "风里有潮湿的光"],
    leisure: ["懂得留一段空白", "街角适合坐下来", "让脚步慢一点"],
  };
  const BLEND_TRAITS = {
    "commercial:residential": "屋檐与街市彼此照应",
    "green:residential": "住在花木的呼吸里",
    "residential:waterside": "回家的路沿水展开",
    "leisure:residential": "家门口也有歇脚处",
    "commercial:green": "小店窗边带着花色",
    "commercial:waterside": "水声陪着来往的脚步",
    "commercial:leisure": "逛累了，转角就能坐下",
    "green:waterside": "从树荫一路走到水边",
    "green:leisure": "连散步也像照料花园",
    "leisure:waterside": "水面替匆忙留了白",
  };
  const DETAILS = {
    residential: "门前的屋檐最先聚成了生活。",
    commercial: "小店和来往的脚步成了小城最清楚的脉搏。",
    green: "花坛、花园和树荫沿着可通行的小路连成一片。",
    waterside: "水面贴着街道展开，把风景带进了日常。",
    leisure: "长椅、广场和凉亭给散步留下了停留的地方。",
  };
  const RESIDENT_LINES = {
    residential: ["回家的小路，我今天又走慢了一点。", "窗边的灯亮着，这一带就有家的样子。", "住在这里，连晚风都认得回家的路。"],
    commercial: ["街角的小店亮着灯，想去看看。", "今天的街市不吵闹，刚刚好热闹。", "从小路转个弯，就能遇见新的日常。"],
    green: ["花又开了一点，这座城正在长大。", "树荫把今天的风留在了街角。", "沿着花木走，连回家也像散步。"],
    waterside: ["水边的风，把今天吹得很轻。", "这条街一直走，就能听见水声。", "水面亮亮的，像替小城留了一扇窗。"],
    leisure: ["坐在街角，看小城慢慢忙起来。", "今天不赶路，找张长椅歇一会儿。", "小城最好的地方，是总有地方坐一坐。"],
  };
  const EMPTY_TRAITS = ["第一笔还在路上", "小城从一片空地开始"];
  const DETACHED_TRAITS = ["风景停在路外", "等一条小路慢慢抵达"];
  const SEASON_WORDS = { spring: "春日", summer: "夏日", autumn: "秋日", winter: "冬日" };

  function stableNumber(value) {
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
  }

  function compareItems(a, b) {
    return a.type.localeCompare(b.type)
      || a.x - b.x
      || a.y - b.y
      || a.rotate - b.rotate;
  }

  function cleanItems(items) {
    if (!Array.isArray(items)) return [];
    const unique = new Map();
    for (const item of items) {
      if (!item || !KNOWN_TYPES.has(item.type) || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
      const clean = {
        type: item.type,
        x: stableNumber(item.x),
        y: stableNumber(item.y),
        rotate: stableNumber(item.rotate),
      };
      const key = `${clean.type}:${clean.x}:${clean.y}:${clean.rotate}`;
      unique.set(key, clean);
    }
    return [...unique.values()].sort(compareItems);
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function signatureFor(items, profile, season, weather) {
    const source = [
      items.map((item) => `${item.type}:${item.x}:${item.y}:${item.rotate}`).join("|"),
      profile.map((entry) => `${entry.id}:${entry.score}`).join("|"),
      season,
      weather,
    ].join("::");
    return `PC18-${hashText(source).toString(36).toUpperCase().padStart(7, "0")}`;
  }

  const gridX = (road) => Math.round(road.x / STEP);
  const gridY = (road) => Math.round((road.y - ORIGIN_Y) / STEP);
  const roadKey = (road) => `${gridX(road)},${gridY(road)}`;
  const isGridRoad = (road) => Math.abs(road.x - gridX(road) * STEP) <= GRID_TOLERANCE
    && Math.abs(road.y - (gridY(road) * STEP + ORIGIN_Y)) <= GRID_TOLERANCE;
  const pointForRoadKey = (key) => {
    const [x, y] = key.split(",").map(Number);
    return { x: x * STEP, y: y * STEP + ORIGIN_Y };
  };
  const compareRoadKeys = (a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return ax - bx || ay - by;
  };

  function largestRoadNetwork(items) {
    const roadMap = new Map();
    for (const item of items) {
      if (item.type !== "road" || !isGridRoad(item)) continue;
      const normalized = pointForRoadKey(roadKey(item));
      roadMap.set(roadKey(normalized), normalized);
    }
    const unseen = new Set(roadMap.keys());
    const components = [];
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (unseen.size) {
      const first = [...unseen].sort(compareRoadKeys)[0];
      const queue = [first];
      const component = [];
      unseen.delete(first);
      for (let index = 0; index < queue.length; index += 1) {
        const key = queue[index];
        component.push(key);
        const [x, y] = key.split(",").map(Number);
        for (const [dx, dy] of directions) {
          const next = `${x + dx},${y + dy}`;
          if (!unseen.delete(next)) continue;
          queue.push(next);
        }
      }
      component.sort(compareRoadKeys);
      components.push(component);
    }
    components.sort((a, b) => b.length - a.length || compareRoadKeys(a[0], b[0]));
    return components[0] || [];
  }

  function hasEntrance(place, roads) {
    return roads.some((road) => {
      const dx = Math.abs(road.x - place.x);
      const dy = Math.abs(road.y - place.y);
      return (dx <= 18 && dy >= 32 && dy <= 76) || (dy <= 18 && dx >= 32 && dx <= 76);
    });
  }

  function nearNetwork(place, roads, radius) {
    return roads.some((road) => Math.hypot(road.x - place.x, road.y - place.y) <= radius);
  }

  function categoryProfile(items, roads) {
    const byType = (type) => items.filter((item) => item.type === type);
    const houses = byType("house").filter((item) => hasEntrance(item, roads));
    const shops = byType("shop").filter((item) => hasEntrance(item, roads));
    const gardens = byType("garden").filter((item) => hasEntrance(item, roads));
    const flowers = byType("flower").filter((item) => hasEntrance(item, roads));
    const trees = byType("tree").filter((item) => nearNetwork(item, roads, 104));
    const benches = byType("bench").filter((item) => hasEntrance(item, roads));
    const plazas = byType("plaza").filter((item) => hasEntrance(item, roads));
    const pavilions = byType("pavilion").filter((item) => hasEntrance(item, roads));
    const lamps = byType("lamp").filter((item) => nearNetwork(item, roads, 92));
    const docks = byType("dock").filter((item) => hasEntrance(item, roads));
    const waters = byType("water").filter((item) => nearNetwork(item, roads, 112)
      || docks.some((dock) => Math.hypot(dock.x - item.x, dock.y - item.y) <= 150));
    const included = new Set([...houses, ...shops, ...gardens, ...flowers, ...trees, ...benches, ...plazas,
      ...pavilions, ...lamps, ...docks, ...waters]);
    return {
      scores: {
        residential: houses.length * 4,
        commercial: shops.length * 4,
        green: gardens.length * 3 + flowers.length * 2 + trees.length,
        waterside: docks.length * 3 + waters.length * 2,
        leisure: plazas.length * 3 + pavilions.length * 3 + benches.length * 2 + lamps.length,
      },
      counts: {
        residential: houses.length,
        commercial: shops.length,
        green: gardens.length + flowers.length + trees.length,
        waterside: docks.length + waters.length,
        leisure: plazas.length + pavilions.length + benches.length + lamps.length,
      },
      included,
    };
  }

  function traitList(profile, hash, unservedCount) {
    const ordered = profile.map((entry) => entry.id);
    const primary = ordered[0];
    let traits = TRAITS[primary].slice(0, 2);
    const secondary = ordered[1];
    if (secondary && profile[1].score >= profile[0].score * 0.34) {
      const pair = [primary, secondary].sort().join(":");
      traits.push(BLEND_TRAITS[pair] || "几种日常，汇在同一条街上");
    }
    if (ordered.length >= 3 && traits.length < 3) traits.push("每种日子都有自己的去处");
    if (unservedCount && traits.length < 4) traits.push("小路外还留着风景");
    const shift = hash % traits.length;
    traits = traits.slice(shift).concat(traits.slice(0, shift));
    return traits.slice(0, 4);
  }

  function residentLineFor(primary, hash, season, weather, empty, detached) {
    if (empty) return "这里还很安静，等第一件小事发生。";
    if (detached) return "花在那边开着，等一条小路慢慢抵达。";
    const lines = RESIDENT_LINES[primary];
    if (weather === "rain") {
      if (primary === "waterside") return "雨点落进水面，小城的声音更轻了。";
      if (primary === "green") return "雨水正一点点照料我们的花园。";
      if (primary === "leisure") return "等雨小一点，再去街角坐坐。";
      return "雨落在回家的屋檐上，刚刚好。";
    }
    const prefix = season === "winter" && hash % 2 === 0 ? "冬日的风里，" : season === "autumn" && hash % 3 === 0 ? "落叶铺到街角时，" : "";
    return prefix + lines[hash % lines.length];
  }

  function analyze(items, options = {}) {
    const clean = cleanItems(items);
    const season = ["spring", "summer", "autumn", "winter"].includes(options.season) ? options.season : "spring";
    const weather = options.weather === "rain" ? "rain" : "sunny";
    const networkKeys = largestRoadNetwork(clean);
    const roads = networkKeys.map(pointForRoadKey);
    const categoryData = categoryProfile(clean, roads);
    const totalScore = Object.values(categoryData.scores).reduce((sum, value) => sum + value, 0);
    const hasNetwork = roads.length > 0;
    const unservedCount = clean.filter((item) => {
      if (item.type === "road" || categoryData.included.has(item)) return false;
      return ["house", "shop", "bench", "plaza", "pavilion", "garden", "dock", "tree", "flower", "water", "lamp"].includes(item.type);
    }).length;
    const contentCount = clean.filter((item) => item.type !== "road").length;
    const empty = clean.length === 0;
    const detached = contentCount > 0 && (!hasNetwork || totalScore === 0);
    const profile = CATEGORY_ORDER.map((id) => ({
      id,
      score: categoryData.scores[id],
      count: categoryData.counts[id],
    })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id));
    const topScore = profile[0]?.score || 0;
    const districts = profile.map((entry) => ({
      id: entry.id,
      label: CATEGORIES[entry.id].label,
      symbol: CATEGORIES[entry.id].symbol,
      count: entry.count,
      strength: Math.max(1, Math.round((entry.score / topScore) * 5)),
    }));
    const signature = signatureFor(clean, profile, season, weather);
    const hash = hashText(signature);

    if (!profile.length) {
      const traits = empty ? [...EMPTY_TRAITS] : [...DETACHED_TRAITS];
      return {
        districts: [],
        traits,
        title: empty ? "一页空白" : "路外的风景",
        summary: empty
          ? "还没有街区。放下第一间小屋或第一段小路，城市就会开始认识自己。"
          : "这里已经有风景，只是主要街道还没有把它们连成日常。远一点的布置仍会留在城里。",
        residentLine: residentLineFor("residential", hash, season, weather, empty, !empty),
        signature,
        seal: empty ? "始" : "远",
        primary: null,
        accessiblePlaces: 0,
        unservedCount,
        smartSummary: "",
      };
    }

    const primary = profile[0].id;
    const traits = traitList(profile, hash, unservedCount);
    const titles = TITLES[primary];
    const title = profile.length >= 4 && profile[3].score >= topScore * 0.5 ? "万象小城" : titles[hash % titles.length];
    const accessiblePlaces = profile.reduce((sum, entry) => sum + entry.count, 0);
    const secondary = profile[1];
    const balance = secondary ? secondary.score / topScore : 0;
    const mixedCopy = secondary && balance >= 0.66
      ? `其中${CATEGORIES[primary].label}与${secondary.id === primary ? "另一种日常" : CATEGORIES[secondary.id].label}同样鲜明。`
      : "";
    const unservedCopy = unservedCount ? " 另一些风景还在主路网之外，等小路慢慢抵达。" : "";
    return {
      districts: districts.slice(0, 4),
      traits,
      title,
      summary: `${SEASON_WORDS[season]}，${DETAILS[primary]}${mixedCopy}${unservedCopy}`,
      residentLine: residentLineFor(primary, hash, season, weather, false, false),
      signature,
      seal: CATEGORIES[primary].seal,
      primary,
      accessiblePlaces,
      unservedCount,
      smartSummary: "",
    };
  }

  return { analyze };
});
