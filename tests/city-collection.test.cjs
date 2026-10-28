const { test } = require('node:test');
const assert = require('node:assert/strict');
const Collection = require('../city-collection.js');
const Life = require('../city-life.js');
const Visitors = require('../city-visitors.js');

test('every populated theme connects homes to shops, dock to gardens, benches and shelter', () => {
  for (const theme of Collection.templates.filter(t => t.id !== 'empty')) {
    const data = Collection.buildTemplate(theme.id), items = data.items, network = Life.createNetwork(items);
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    for (const road of network.roads) { assert.ok(road.x % 48 === 0); assert.ok((road.y - 12) % 48 === 0); }
    const shops = items.filter(i => i.type === 'shop');
    for (const home of items.filter(i => i.type === 'house')) assert.ok(Life.findRoute(home, shops, network), theme.id);
    const dock = items.find(i => i.type === 'dock');
    for (const target of items.filter(i => ['garden', 'bench', 'pavilion'].includes(i.type))) assert.ok(Life.findRoute(dock, [target], network), `${theme.id}: ${target.type}`);
    const visitors = Visitors.createSimulation(); visitors.sync(items);
    assert.ok(visitors.preparation().conditions.every(c => c.done), theme.id);
    assert.equal(visitors.invite(), true);
    for (let i = 0; i < 1600; i++) visitors.tick(.1);
    assert.equal(visitors.count, 1, theme.id);
    assert.equal(visitors.drainEvents().filter(e => e.kind === 'postcard').length, 1);
  }
});

test('empty islands start empty, and each template is editable without changing later creations', () => {
  assert.deepEqual(Collection.buildTemplate('empty').items, []);
  const a = Collection.buildTemplate('forest'), b = Collection.buildTemplate('forest');
  a.items[0].x = 999; a.progress.accepted.push('shade:1');
  assert.notEqual(b.items[0].x, 999); assert.deepEqual(b.progress.accepted, []);
  assert.throws(() => Collection.buildTemplate('unknown'));
});

test('copying a city preserves gardens, wishes, visitors, journals and album in independent objects', () => {
  const source = Collection.buildTemplate('garden');
  source.progress.accepted = ['shade:1']; source.progress.identities = [{ homeId: 1, slot: 2 }];
  source.environment = { weather: { kind: 'rain', auto: false }, gardens: [{ id: 20, growth: .8, moisture: .6 }] };
  source.journal = [{ id: 'garden:20', title: '花开', text: '春天', createdAt: 1000 }];
  source.postcards = [{ id: 'visit-1', cityName: source.cityName, image: 'data:image/jpeg;base64,YQ==', createdAt: 1000 }];
  source.visitors = { count: 2, active: { id: 'visit-2', phase: 'walking' } };
  const a = Collection.makeRecord(source, 'garden'), b = Collection.makeRecord(a.data, a.theme, '改建副本');
  assert.notEqual(a.id, b.id); assert.equal(b.revision, 0);
  assert.deepEqual(a.data.environment, b.data.environment); assert.deepEqual(a.data.visitors, b.data.visitors);
  b.data.items.pop(); b.data.environment.gardens[0].growth = 0; b.data.journal[0].text = '新故事'; b.data.postcards.length = 0; b.data.progress.accepted.length = 0;
  assert.notEqual(a.data.items.length, b.data.items.length); assert.equal(a.data.environment.gardens[0].growth, .8);
  assert.equal(a.data.journal[0].text, '春天'); assert.equal(a.data.postcards.length, 1); assert.equal(a.data.progress.accepted.length, 1);
});

test('export and import round trip a full city with stable history and names', () => {
  const source = Collection.buildTemplate('waterfront'); source.paused = true; source.minutes = 1234;
  source.journal = [{ id: 'memory', title: '旧故事', text: '今天也很好', createdAt: 1000 }];
  source.postcards = [{ id: 'visit', cityName: '往日的城名', image: 'data:image/jpeg;base64,YQ==', createdAt: 2000 }];
  const record = Collection.makeRecord(source, 'waterfront');
  const restored = Collection.parseImport(JSON.stringify(Collection.exportFile(record)));
  assert.deepEqual(restored.data, record.data); assert.equal(restored.theme, 'waterfront');
  const imported = Collection.makeRecord(restored.data, restored.theme);
  assert.notEqual(imported.id, record.id);
  assert.equal(imported.data.postcards[0].cityName, '往日的城名');
});

test('names stay short and collisions are resolved without overwriting a city', () => {
  assert.equal(Collection.uniqueName('小城', ['小城', '小城 · 2']), '小城 · 3');
  assert.equal(Collection.uniqueName('   '), '未命名小城');
  const long = '一二三四五六七八九十一二三四五六七八';
  const next = Collection.uniqueName(long, [long]); assert.ok(next.length <= 18); assert.notEqual(next, long);
});

test('unrecognized, future, truncated and invalid layouts are rejected without creating a record', () => {
  const base = Collection.exportFile(Collection.makeRecord(Collection.buildTemplate('forest'), 'forest'));
  assert.throws(() => Collection.parseImport('not json'));
  assert.throws(() => Collection.parseImport(JSON.stringify({ format: 'other', items: [] })));
  assert.throws(() => Collection.parseImport(JSON.stringify({ ...base, version: 999 })));
  for (const change of [
    file => file.city.data.items.push({ ...file.city.data.items[0] }),
    file => file.city.data.items[0].type = 'script',
    file => file.city.data.items[0].x = null,
    file => file.city.data.items[0].x = 90000,
    file => delete file.city.data.cityName,
  ]) { const file = JSON.parse(JSON.stringify(base)); change(file); assert.throws(() => Collection.parseImport(JSON.stringify(file))); }
});

test('import never accepts executable scenes, remote image references or oversized albums', () => {
  const base = Collection.exportFile(Collection.makeRecord(Collection.buildTemplate('empty'), 'empty'));
  for (const card of [{ pendingScene: '<svg onload="alert(1)"></svg>' }, { image: 'https://example.test/city.svg' }, { image: 'data:image/svg+xml;base64,YQ==' }]) {
    const file = JSON.parse(JSON.stringify(base)); file.city.data.postcards = [card];
    assert.throws(() => Collection.parseImport(JSON.stringify(file)));
  }
  base.city.data.postcards = Array(25).fill({}); assert.throws(() => Collection.parseImport(JSON.stringify(base)));
});

test('older single-city backup data imports as a new record and migrates second-version roads once', () => {
  const old = { schema: 2, cityName: '旧城', items: [{ id: 1, type: 'road', x: 0, y: 0 }] };
  const parsed = Collection.parseImport(JSON.stringify(old));
  assert.equal(parsed.data.items[0].y, 12); assert.equal(parsed.data.schema, 7);
  assert.equal(Collection.parseImport(JSON.stringify(Collection.exportFile(Collection.makeRecord(parsed.data)))).data.items[0].y, 12);
});
