(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityDesign = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STEP = 48, ORIGIN = 12;
  const directions = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  const connectable = new Set(["house", "shop", "bench", "plaza", "pavilion", "garden", "dock"]);
  const key = (p) => `${Math.round(p.x / STEP)},${Math.round((p.y - ORIGIN) / STEP)}`;
  const nearby = (a, b, radius) => Math.hypot(a.x - b.x, a.y - b.y) <= radius;

  function roadDirections(road, items) {
    return Object.entries(directions).filter(([, [dx, dy]]) => items.some((item) => item.type === "road" && item.id !== road.id
      && Math.abs(item.x - road.x - dx * STEP) <= 4 && Math.abs(item.y - road.y - dy * STEP) <= 4)).map(([name]) => name);
  }

  function roadPath(names, length = 24) {
    const ends = names.map((name) => directions[name].map((n) => n * length));
    if (!ends.length) return "M-10 0H10";
    if (ends.length === 2 && names[0] !== ({ n: "s", s: "n", e: "w", w: "e" })[names[1]]) {
      return `M${ends[0][0]} ${ends[0][1]}Q0 0 ${ends[1][0]} ${ends[1][1]}`;
    }
    return ends.map(([x, y]) => `M0 0L${x} ${y}`).join(" ");
  }

  function houseStyle(house, items) {
    const others = items.filter((item) => item.id !== house.id);
    const neighbors = others.filter((item) => item.type === "house" && nearby(house, item, 112) && Math.abs(item.y - house.y) <= 30).length;
    if (others.some((item) => item.type === "water" && nearby(house, item, 145))) return { kind: "waterfront", label: "临水小屋", detail: "靠近水面，蓝灰屋顶与小露台接住水边的风。", neighbors };
    if (others.some((item) => ["garden", "flower"].includes(item.type) && nearby(house, item, 112))) return { kind: "garden", label: "花园小屋", detail: "花草就在窗边，屋檐添上藤蔓和一排小花。", neighbors };
    if (neighbors) return { kind: "row", label: "邻里小楼", detail: "邻居住得近一些，小屋长出阁楼和相互照应的门廊。", neighbors };
    if (others.some((item) => item.type === "tree" && nearby(house, item, 112))) return { kind: "forest", label: "林间小屋", detail: "树荫落在屋顶，木色门廊多了一点林间气息。", neighbors };
    return { kind: "cottage", label: "暖阳小屋", detail: "一间安静的小屋。添上水面、花草或邻居，会出现新的模样。", neighbors: 0 };
  }

  function cornerStyle(item, items) {
    if (!item) return null;
    const near = (types, radius) => items.some(other => other.id !== item.id && types.includes(other.type) && nearby(item, other, radius));
    if (item.type === "bench") {
      if (near(["tree"], 100)) return { kind: "shade", label: "树荫长椅", detail: "树荫落在椅边，多了几片叶子，适合坐下读书。" };
      if (near(["water"], 130)) return { kind: "waterside", label: "临水长椅", detail: "椅边长出细细的芦苇，坐下来听听水声。" };
      if (near(["lamp"], 100)) return { kind: "lamplit", label: "灯下长椅", detail: "灯旁添一盆小花，给晚归的人留一个温暖的角落。" };
    }
    if (item.type === "shop" && near(["garden", "flower"], 112)) return { kind: "florist", label: "花间小商店", detail: "花草来到门前，窗边也添上一排小花。" };
    return null;
  }

  function planConnection(building, items) {
    const result = (status, additions = [], path = []) => ({ status, additions, path });
    if (!building || !connectable.has(building.type)) return result("unsupported");
    const allRoads = items.filter((item) => item.type === "road");
    if (!allRoads.length) return result("no-roads");
    const roads = allRoads.filter((road) => Math.abs(road.x - Math.round(road.x / STEP) * STEP) <= 4
      && Math.abs(road.y - (Math.round((road.y - ORIGIN) / STEP) * STEP + ORIGIN)) <= 4);
    if (!roads.length) return result("blocked");
    const roadKeys = new Set(roads.map(key));
    const unseen = new Set(roadKeys), components = [];
    while (unseen.size) {
      const component = new Set(), queue = [unseen.values().next().value]; unseen.delete(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i]; component.add(current);
        const [x, y] = current.split(",").map(Number);
        for (const [dx, dy] of Object.values(directions)) {
          const next = `${x + dx},${y + dy}`;
          if (unseen.delete(next)) queue.push(next);
        }
      }
      components.push(component);
    }
    components.sort((a, b) => b.size - a.size);
    const main = components[0];
    const footprint = { house: [35, 32], shop: [38, 32], water: [58, 36], tree: [17, 17], garden: [29, 21], flower: [27, 20], bench: [29, 18], plaza: [35, 24], pavilion: [36, 29], dock: [37, 22], lamp: [9, 9] };
    const solids = items.flatMap((item) => {
      const bounds = footprint[item.type]; if (!bounds) return [];
      const rotated = Math.abs((item.rotate || 0) % 180) === 90;
      const [rx, ry] = rotated ? [bounds[1], bounds[0]] : bounds;
      return [{ x: item.x, y: item.y, rx, ry }];
    });
    const crosses = (a, b) => solids.some((item) => a.x === b.x
      ? Math.abs(a.x - item.x) < item.rx && Math.max(a.y, b.y) > item.y - item.ry && Math.min(a.y, b.y) < item.y + item.ry
      : Math.abs(a.y - item.y) < item.ry && Math.max(a.x, b.x) > item.x - item.rx && Math.min(a.x, b.x) < item.x + item.rx);
    const cells = new Map();
    for (let x = -384; x <= 384; x += STEP) for (let y = -228; y <= 204; y += STEP) {
      const point = { x, y }, id = key(point);
      const blocked = !roadKeys.has(id) && solids.some((item) => Math.abs(item.x - x) < item.rx && Math.abs(item.y - y) < item.ry);
      if (!blocked) cells.set(id, point);
    }
    const entrances = [...cells.entries()].filter(([, point]) => {
      const dx = Math.abs(point.x - building.x), dy = Math.abs(point.y - building.y);
      return (dx <= 18 && dy >= 32 && dy <= 76) || (dy <= 18 && dx >= 32 && dx <= 76);
    });
    if (entrances.some(([id]) => main.has(id))) return result("connected");
    const costs = new Map(), previous = new Map(), queue = [];
    for (const [id] of entrances) {
      const cost = roadKeys.has(id) ? 1 : 1001;
      costs.set(id, cost); previous.set(id, null); queue.push({ id, cost });
    }
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const { id, cost } = queue.shift();
      if (cost !== costs.get(id)) continue;
      if (main.has(id)) {
        const path = [];
        for (let node = id; node !== null; node = previous.get(node)) path.unshift(cells.get(node));
        return result("ready", path.filter((point) => !roadKeys.has(key(point))), path);
      }
      const [x, y] = id.split(",").map(Number);
      for (const [dx, dy] of Object.values(directions)) {
        const next = `${x + dx},${y + dy}`;
        if (!cells.has(next)) continue;
        if ((!roadKeys.has(id) || !roadKeys.has(next)) && crosses(cells.get(id), cells.get(next))) continue;
        const nextCost = cost + (roadKeys.has(next) ? 1 : 1001);
        if (nextCost < (costs.get(next) ?? Infinity)) {
          costs.set(next, nextCost); previous.set(next, id); queue.push({ id: next, cost: nextCost });
        }
      }
    }
    return result("blocked");
  }

  return { roadDirections, roadPath, houseStyle, cornerStyle, planConnection, connectable };
});
