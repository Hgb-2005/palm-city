const test = require('node:test');
const assert = require('node:assert/strict');
const Building = require('../city-building.js');
const Design = require('../city-design.js');
const item = (id, type = 'tree', x = 0, y = 0) => ({ id, type, x, y, rotate: 0 });
const edit = (h, before, after, label) => { h.begin(before, label); return h.commit(after); };

test('build feedback tracks adds, moves, removals and undo without mutating layouts', () => {
  const before = [item(1), item(2, 'road', 48, 12), item(3, 'house', 96, 0)];
  const after = [{ ...before[0], rotate: 90 }, before[1], item(4, 'flower', 120, 60)];
  const original = JSON.stringify({ before, after });
  const changes = Building.layoutChanges(before, after);
  assert.deepEqual(changes.map(change => [change.id, change.kind]), [[1, 'move'], [4, 'add'], [3, 'remove']]);
  assert.deepEqual(Building.layoutChanges(after, before).map(change => [change.id, change.kind]), [[1, 'move'], [3, 'add'], [4, 'remove']]);
  assert.deepEqual(Building.layoutChanges(before, before), []);
  assert.equal(JSON.stringify({ before, after }), original);
});

test('multiple undo and redo steps recover exact identities, positions, rotation and labels', () => {
  const h = Building.createHistory(), a = [item(1)], b = [...a, item(2)], c = [item(2, 'tree', 48, 12)]; c[0].rotate = 90;
  assert.equal(edit(h, a, b, '放置'), true); edit(h, b, c, '调整');
  assert.deepEqual(h.undo(c), { items: b, label: '调整' });
  assert.deepEqual(h.undo(b), { items: a, label: '放置' }); assert.equal(h.canUndo, false);
  assert.deepEqual(h.redo(a), { items: b, label: '放置' });
  assert.deepEqual(h.redo(b), { items: c, label: '调整' }); assert.equal(h.redo(c), null);
});
test('only a committed change replaces the redo branch', () => {
  const h = Building.createHistory(), a = [], b = [item(1)]; edit(h, a, b); h.undo(b);
  h.begin(a); assert.equal(h.canRedo, false); assert.equal(h.commit(a), false); assert.equal(h.canRedo, true);
  h.begin(a); assert.deepEqual(h.cancel(), a); assert.equal(h.canRedo, true);
  edit(h, a, [item(2)]); assert.equal(h.canRedo, false);
});
test('a drag returning to its origin records no step and preserves future', () => {
  const h = Building.createHistory(), a = [item(1)], b = [...a, item(2)]; edit(h, a, b); h.undo(b);
  const moving = a.map(i => ({ ...i })); h.begin(moving, '移动'); moving[0].x = 48; moving[0].x = 0;
  assert.equal(h.commit(moving), false); assert.equal(h.size, 0); assert.equal(h.canRedo, true);
});
test('pending edits expose the original save layout and block traversal until committed or cancelled', () => {
  const h = Building.createHistory(), a = [item(1)], b = [item(2)]; edit(h, a, b); h.begin(b);
  b[0].x = 72; const original = [item(2)]; assert.deepEqual(h.pendingItems, original);
  assert.equal(h.undo(b), null); assert.equal(h.redo(b), null); assert.equal(h.canUndo, false);
  assert.deepEqual(h.cancel(), original); assert.equal(h.canUndo, true); assert.equal(h.pendingItems, null);
});
test('history snapshots, returned layouts and pending saves cannot mutate one another', () => {
  const h = Building.createHistory(), a = [item(1)]; h.begin(a); a[0].x = 48;
  const saved = h.pendingItems; saved[0].x = 999; h.commit(a);
  const undone = h.undo(a); assert.equal(undone.items[0].x, 0); undone.items[0].x = -999;
  const redone = h.redo(undone.items); assert.equal(redone.items[0].x, 48);
});
test('history retains 24 edits and clear removes pending, past and future for a city switch', () => {
  const h = Building.createHistory(); let items = [];
  for (let i = 0; i < 30; i++) { const next = [...items, item(i)]; edit(h, items, next); items = next; }
  assert.equal(h.size, 24);
  for (let i = 0; i < 24; i++) items = h.undo(items).items;
  assert.equal(items.length, 6); assert.equal(h.undo(items), null); h.begin(items); h.clear();
  assert.equal(h.canUndo, false); assert.equal(h.canRedo, false); assert.equal(h.pendingItems, null);
});
test('snapping uses the same 12 unit material grid and offset 48 unit road grid as placement', () => {
  assert.deepEqual(Building.snap({ x: 17, y: -17 }, 'tree'), { x: 12, y: -12 });
  assert.deepEqual(Building.snap({ x: -49, y: 61 }, 'road'), { x: -48, y: 60 });
  assert.equal(Building.onIsland({ x: 411, y: 0 }), false); assert.equal(Building.onIsland({ x: -430, y: 215 }), true);
});
test('road strokes fill skipped pointer cells in order, avoid occupied roads and stay on the island', () => {
  const roads = [item(1, 'road', 48, 12), item(2, 'road', 99, 12)];
  assert.deepEqual(Building.roadStroke({ x: 0, y: 12 }, { x: 144, y: 60 }, roads), [{ x: 0, y: 12 }, { x: 144, y: 12 }, { x: 144, y: 60 }]);
  const points = Building.roadStroke({ x: -1000, y: 12 }, { x: 1000, y: 12 }, []);
  assert.ok(points.length); assert.ok(points.every(Building.onIsland));
  assert.deepEqual(Building.roadStroke({ x: 48, y: 12 }, { x: 48, y: 12 }, roads), []);
});
test('connection counts include only buildings reachable along the actual road network', () => {
  const bench = item(1, 'bench', 0, 60), home = item(2, 'house', -96, -36), shop = item(3, 'shop', 96, -36);
  const items = [bench, home, shop, item(4, 'house', 288, -36), ...[-96,-48,0,48,96,288].map((x,i) => item(10+i, 'road', x, 12))];
  const info = Building.connectionInfo(bench, items, Design.planConnection(bench, items));
  assert.equal(info.homes, 1); assert.equal(info.shops, 1); assert.deepEqual(info.entrance, items.find(i => i.type === 'road' && i.x === 0));
  const disconnected = items.filter(i => !(i.type === 'road' && i.x === 0));
  const missing = Building.connectionInfo(bench, disconnected, Design.planConnection(bench, disconnected));
  assert.equal(missing.homes, 0); assert.equal(missing.shops, 0); assert.equal(missing.entrance, null);
});
test('planned roads do not count as reachable until built and a source home never counts itself', () => {
  const home = item(1, 'house', 0, -180), shop = item(2, 'shop', 0, 60), road = item(3, 'road', 0, 12), items = [home, shop, road];
  const plan = Design.planConnection(home, items); assert.equal(plan.status, 'ready');
  assert.equal(Building.connectionInfo(home, items, plan).shops, 0);
  const built = [...items, ...plan.additions.map((p,i) => ({ ...item(10+i, 'road'), ...p }))];
  const info = Building.connectionInfo(home, built, Design.planConnection(home, built));
  assert.equal(info.shops, 1); assert.equal(info.homes, 0);
  assert.equal(Building.connectionInfo(item(9), [], { status: 'unsupported' }).title, '');
});
