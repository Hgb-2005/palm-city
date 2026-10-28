(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./city-life.js") : root.PalmCityLife);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityBuilding = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Life) {
  "use strict";
  const clone = items => items.map(item => ({ ...item }));
  const same = (a, b) => a.length === b.length && a.every((item, index) => {
    const other = b[index];
    return item.id === other.id && item.type === other.type && item.x === other.x && item.y === other.y && (item.rotate || 0) === (other.rotate || 0);
  });
  function createHistory(limit = 24) {
    let past = [], future = [], pending = null;
    return {
      begin(items, label = "布置") { if (!pending) pending = { items: clone(items), label }; },
      commit(items) {
        if (!pending) return false;
        const before = pending; pending = null;
        if (same(before.items, items)) return false;
        past.push(before); if (past.length > limit) past.shift(); future = []; return true;
      },
      cancel() { const before = pending; pending = null; return before ? clone(before.items) : null; },
      undo(items) {
        if (pending || !past.length) return null;
        const previous = past.pop(); future.push({ items: clone(items), label: previous.label });
        return { items: clone(previous.items), label: previous.label };
      },
      redo(items) {
        if (pending || !future.length) return null;
        const next = future.pop(); past.push({ items: clone(items), label: next.label });
        return { items: clone(next.items), label: next.label };
      },
      clear() { past = []; future = []; pending = null; },
      get canUndo() { return past.length > 0 && !pending; },
      get canRedo() { return future.length > 0 && !pending; },
      get undoLabel() { return past.at(-1)?.label || ""; },
      get redoLabel() { return future.at(-1)?.label || ""; },
      get size() { return past.length; },
      get pendingItems() { return pending ? clone(pending.items) : null; },
    };
  }
  function snap(point, type) {
    const step = type === "road" ? 48 : 12, offset = type === "road" ? 12 : 0;
    return { x: Math.round(point.x / step) * step || 0, y: Math.round((point.y - offset) / step) * step + offset || 0 };
  }
  const onIsland = point => point.x >= -430 && point.x <= 410 && point.y >= -255 && point.y <= 215;
  function layoutChanges(before, after) {
    const old = new Map(before.map(item => [item.id, item])), next = new Set(after.map(item => item.id)), changes = [];
    for (const item of after) {
      const previous = old.get(item.id);
      if (!previous) changes.push({ ...item, kind: "add" });
      else if (previous.x !== item.x || previous.y !== item.y || (previous.rotate || 0) !== (item.rotate || 0)) changes.push({ ...item, kind: "move" });
    }
    for (const item of before) if (!next.has(item.id)) changes.push({ ...item, kind: "remove" });
    return changes;
  }
  function roadStroke(from, to, items) {
    const cursor = snap(from, "road"), end = snap(to, "road"), additions = [];
    const occupied = items.filter(item => item.type === "road");
    const steps = Math.min(80, Math.round((Math.abs(end.x - cursor.x) + Math.abs(end.y - cursor.y)) / 48));
    for (let i = 0; i <= steps; i++) {
      if (onIsland(cursor) && !occupied.some(item => Math.abs(item.x - cursor.x) < 4 && Math.abs(item.y - cursor.y) < 4)) additions.push({ ...cursor });
      if (cursor.x !== end.x) cursor.x += Math.sign(end.x - cursor.x) * 48;
      else if (cursor.y !== end.y) cursor.y += Math.sign(end.y - cursor.y) * 48;
    }
    return additions;
  }
  function connectionInfo(building, items, plan) {
    const titles = { connected: "已接入主要街道", ready: "还差一小段路", "no-roads": "先留下第一段小路", blocked: "暂时找不到接路的位置" };
    if (!building || plan.status === "unsupported") return { title: "", homes: 0, shops: 0, entrance: null };
    const network = Life.createNetwork(items);
    const reachable = type => items.filter(item => item.type === type && item.id !== building.id && Life.findRoute(building, [item], network)).length;
    return { title: titles[plan.status] || "", homes: reachable("house"), shops: reachable("shop"), entrance: Life.entrances(building, network.roads)[0] || null };
  }
  return { createHistory, snap, onIsland, layoutChanges, roadStroke, connectionInfo };
});
