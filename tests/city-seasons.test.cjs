const test = require('node:test');
const assert = require('node:assert/strict');
const Seasons = require('../city-seasons.js');
const Roaming = require('../city-roaming.js');
const Collection = require('../city-collection.js');
const Life = require('../city-life.js');
const photo = (season) => Roaming.makePhoto({ season, cityName: '同一个街角', minutes: 540, image: 'data:image/jpeg;base64,/9j/AA==', width: 1000, height: 600 });

test('four manually selected seasons have distinct palettes and invalid local states safely use spring', () => {
  assert.deepEqual(Object.keys(Seasons.seasons), ['spring', 'summer', 'autumn', 'winter']);
  for (const value of [null, undefined, 'constructor', '__proto__', 'rain', {}, ['winter']]) {
    assert.equal(Seasons.isSeason(value), false); assert.equal(Seasons.normalize(value), 'spring'); assert.equal(Seasons.label(value), '');
  }
  assert.equal(new Set(Object.values(Seasons.seasons).map(s => s.tree[0])).size, 4);
  assert.equal(Seasons.label('winter'), '冬日');
});

test('season lighting changes daylight colors while retaining night contrast and respecting the dusk curve', () => {
  const base = '#e6e0b6';
  assert.equal(new Set(Object.keys(Seasons.seasons).map(s => Seasons.tint(base, 'land', 0, s, 9))).size, 4);
  for (const season of Object.keys(Seasons.seasons)) {
    assert.equal(Seasons.tint('#263844', 'sky', 0, season, 22), 'rgb(38,56,68)');
    assert.equal(Seasons.tint('#263844', 'sky', 0, season, -2), Seasons.tint('#263844', 'sky', 0, season, 22));
    assert.notEqual(Seasons.tint(base, 'land', 0, season, 9), Seasons.tint(base, 'land', 0, season, 18));
    assert.equal(Seasons.tint(base, 'unknown', 0, season, 9), base);
  }
  const winter = Seasons.tint(base, 'land', 0, 'winter', 9).match(/\d+/g).map(Number);
  const summer = Seasons.tint(base, 'land', 0, 'summer', 9).match(/\d+/g).map(Number);
  assert.ok(winter[2] > summer[2] + 40);
});

test('seasonal decorations are stable at redraw and change trees, roofs and streets without adding build items', () => {
  assert.match(Seasons.treeDecor('spring', 123), /season-blossoms/);
  assert.equal(Seasons.treeDecor('summer', 123), '');
  assert.match(Seasons.treeDecor('autumn', 123), /season-leaves/);
  assert.match(Seasons.treeDecor('winter', 123), /season-snow/);
  for (const season of Object.keys(Seasons.seasons)) assert.equal(Seasons.treeDecor(season, 123), Seasons.treeDecor(season, 123));
  for (const type of ['house', 'shop', 'pavilion', 'bench', 'dock']) assert.match(Seasons.snowCap(type), /roof-snow/);
  assert.notEqual(Seasons.snowCap('house'), Seasons.snowCap('house', true));
  assert.equal(Seasons.snowCap('road'), ''); assert.equal(Seasons.snowCap('constructor'), '');
  assert.match(Seasons.groundDecor('winter'), /snow-patch/);
});

test('neighbors wear summer hats and winter scarves and talk about the selected season and rain', () => {
  assert.match(Seasons.outfit('summer', 0), /resident-straw-hat/);
  assert.match(Seasons.outfit('winter', 0), /resident-winter-scarf/);
  assert.notEqual(Seasons.outfit('winter', 0), Seasons.outfit('winter', 1));
  assert.equal(Seasons.outfit('spring', 0), '');
  assert.match(Seasons.residentLine('autumn', { slot: 0 }), /落叶/);
  assert.match(Seasons.residentLine('winter', { slot: 0 }), /围巾/);
  assert.match(Seasons.residentLine('summer', { slot: 0 }, 'rain'), /伞/);
  assert.match(Seasons.residentLine('winter', { phase: 'sheltered' }, 'rain'), /凉亭/);
});

test('new pictures remember their season while legacy pictures remain unlabelled and unchanged', () => {
  const autumn = photo('autumn'), legacy = photo(undefined);
  assert.equal(autumn.season, 'autumn'); assert.equal(Object.hasOwn(legacy, 'season'), false);
  const cleaned = Roaming.cleanPhotos([autumn, legacy]);
  assert.deepEqual(cleaned, [autumn, legacy]);
  for (const season of ['constructor', '__proto__', null, 1, ['spring']]) {
    assert.throws(() => Roaming.validatePhotos([{ ...autumn, season }]));
  }
});

test('season, historical photographs and postcards roundtrip in an independent city backup', () => {
  const data = Collection.buildTemplate('forest'); data.season = 'winter'; data.photos = [photo('autumn'), photo(undefined)];
  data.postcards = [{ id: 'old-visit', image: 'data:image/jpeg;base64,AA==', season: 'summer' }];
  const source = Collection.makeRecord(data), restored = Collection.parseImport(JSON.stringify(Collection.exportFile(source)));
  assert.deepEqual(restored.data, source.data);
  const copy = Collection.makeRecord(restored.data, 'forest'); copy.data.season = 'spring'; copy.data.photos[0].note = '后来的一天';
  assert.equal(source.data.season, 'winter'); assert.equal(source.data.photos[0].season, 'autumn'); assert.equal(source.data.photos[0].note, '');
  assert.equal(Object.hasOwn(source.data.photos[1], 'season'), false);
  const old = Collection.buildTemplate('empty'); delete old.season;
  assert.equal(Collection.parseImport(JSON.stringify(old)).data.season, undefined);
});

test('imports reject invalid city, photo and postcard seasons without accepting prototype names', () => {
  const data = Collection.buildTemplate('forest');
  for (const bad of ['constructor', '__proto__', 'monsoon', null, 1, ['winter']]) {
    assert.throws(() => Collection.parseImport(JSON.stringify({ ...data, season: bad })));
    assert.throws(() => Collection.parseImport(JSON.stringify({ ...data, photos: [{ ...photo('spring'), season: bad }] })));
    assert.throws(() => Collection.parseImport(JSON.stringify({ ...data, postcards: [{ season: bad }] })));
  }
});

test('changing seasonal scenery keeps the real resident journey, identity and wishes intact', () => {
  const data = Collection.buildTemplate('forest'), simulation = Life.createSimulation(); simulation.sync(data.items);
  for (let i = 0; i < 25; i++) simulation.tick(.1);
  const resident = simulation.residents.find(r => r.visible), before = simulation.progress(); assert.ok(resident);
  const route = resident.route, position = { x: resident.x, y: resident.y }, plan = resident.plan;
  for (const season of Object.keys(Seasons.seasons)) {
    Seasons.treeDecor(season, 1); Seasons.groundDecor(season); Seasons.outfit(season, resident.slot);
    simulation.sync(data.items);
    assert.equal(resident.route, route); assert.equal(resident.plan, plan);
    assert.deepEqual({ x: resident.x, y: resident.y }, position); assert.deepEqual(simulation.progress(), before);
  }
});
