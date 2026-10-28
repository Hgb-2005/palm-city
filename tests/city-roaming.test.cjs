const test = require('node:test');
const assert = require('node:assert/strict');
const Roaming = require('../city-roaming.js');
const Collection = require('../city-collection.js');
const photo = (changes = {}) => ({
  id: 'photo-a', createdAt: 1793060000000, cityName: '从前的松风城', note: '晚风刚刚好。',
  followedName: '小林', clock: '18:30', weather: 'sunny', preset: 'neighbor',
  image: 'data:image/jpeg;base64,/9j/AA==', width: 1200, height: 720, ...changes,
});
const backupWith = photos => {
  const data = Collection.buildTemplate('forest'); data.photos = photos;
  return JSON.stringify(Collection.exportFile(Collection.makeRecord(data)));
};

test('each framing places the chosen world point at the center and clamps manual zoom', () => {
  for (const preset of ['overview', 'street', 'neighbor']) {
    const result = Roaming.frame(preset, { x: 144, y: -84 });
    assert.equal(144 * result.zoom + result.panX, 0);
    assert.equal(-84 * result.zoom + result.panY, 0);
  }
  assert.equal(Roaming.clampZoom(100), 3.6);
  assert.equal(Roaming.clampZoom(-1), .72);
  assert.equal(Roaming.clampZoom(undefined), 1);
  assert.equal(Roaming.clampZoom(NaN), 1);
  assert.equal(Roaming.frame('constructor').zoom, 1);
});

test('camera easing converges without overshooting and is independent of frame frequency', () => {
  const start = { zoom: 1, panX: 0, panY: 0 }, target = { zoom: 3.1, panX: -230, panY: 150 };
  assert.deepEqual(Roaming.smooth(start, target, 0), start);
  assert.deepEqual(Roaming.smooth(start, target, -1), start);
  assert.deepEqual(Roaming.smooth(start, target, .01, true), target);
  let a = start, b = start;
  for (let i = 0; i < 60; i++) a = Roaming.smooth(a, target, 1 / 60);
  for (let i = 0; i < 30; i++) b = Roaming.smooth(b, target, 1 / 30);
  for (const key of Object.keys(start)) assert.ok(Math.abs(a[key] - b[key]) < 1e-10);
  assert.ok(a.zoom > 3.09 && a.zoom < target.zoom);
  assert.ok(a.panX > target.panX && a.panY < target.panY);
  assert.deepEqual(Roaming.smooth(start, target, 20), Roaming.smooth(start, target, .1));
});

test('phone framing fills its viewport while retaining the entire island at overview', () => {
  for (const [width, height] of [[296, 354], [366, 354], [700, 300]]) {
    const box = Roaming.viewport(width, height, true);
    assert.ok(Math.abs(box.width / box.height - width / height) < 1e-10);
    assert.ok(box.x <= -460 && box.x + box.width >= 460, 'dock and island margins remain visible');
    assert.ok(box.y <= -300 && box.y + box.height >= 300);
  }
  const phone = Roaming.viewport(296, 354, true);
  assert.ok(296 / phone.width > 296 / 1240 * 1.25, 'island grows by more than a quarter without changing saved zoom');
  assert.deepEqual(Roaming.viewport(0, 0, true), Roaming.viewport(1600, 900));
});

test('following focuses a visible neighbor or their home while they are indoors', () => {
  const resident = { x: 50, y: 60, visible: true, home: { x: -144, y: -84 } };
  assert.deepEqual(Roaming.focusResident(resident), { x: 50, y: 42 });
  assert.deepEqual(Roaming.focusResident({ ...resident, visible: false }), { x: -144, y: -102 });
  assert.equal(Roaming.focusResident(null), null);
  assert.equal(Roaming.focusResident({ visible: true, x: NaN, y: 3 }), null);
});

test('new photos freeze historical metadata and constrain notes and names', () => {
  const result = Roaming.makePhoto({ ...photo(), minutes: 1470, note: '  ' + '风'.repeat(90) + '  ', cityName: '城'.repeat(25), preset: 'constructor' });
  assert.equal(result.clock, '00:30'); assert.equal(Roaming.clock(-30), '23:30');
  assert.equal(result.cityName.length, 18); assert.equal(result.note.length, 80);
  assert.equal(result.preset, 'custom'); assert.match(result.id, /^photo-/);
  assert.equal(result.image, photo().image);
});

test('album backup roundtrip and city copies preserve pictures and isolate later note changes', () => {
  const original = Collection.makeRecord({ ...Collection.buildTemplate('forest'), photos: [photo()] });
  const restored = Collection.parseImport(JSON.stringify(Collection.exportFile(original)));
  const copy = Collection.makeRecord(restored.data, 'forest', '现在的新城名');
  assert.deepEqual(copy.data.photos, original.data.photos);
  copy.data.photos[0].note = '新的留言';
  assert.equal(original.data.photos[0].note, '晚风刚刚好。');
  assert.equal(copy.data.photos[0].cityName, '从前的松风城');
  assert.equal(copy.data.photos[0].image, original.data.photos[0].image);
});

test('old cities without a personal album remain valid and cleanly start empty', () => {
  const data = Collection.buildTemplate('forest'); delete data.photos;
  const restored = Collection.parseImport(JSON.stringify(data));
  assert.deepEqual(Roaming.cleanPhotos(restored.data.photos), []);
  assert.deepEqual(restored.data.items, data.items);
});

test('imports reject duplicate IDs, excess capacity, oversized pictures and active or remote scenes', () => {
  assert.throws(() => Collection.parseImport(backupWith([photo(), photo()])));
  assert.throws(() => Collection.parseImport(backupWith(Array.from({ length: 21 }, (_, i) => photo({ id: `photo-${i}` })))));
  for (const changes of [
    { image: 'data:image/jpeg;base64,' + 'A'.repeat(Roaming.IMAGE_LIMIT) },
    { image: 'https://example.test/photo.jpg' }, { image: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { pendingScene: '<svg onload="alert(1)"/>' }, { image: 'data:image/jpeg;base64,\" onload=\"bad' },
    { note: '风'.repeat(81) }, { width: 99999 }, { height: 0 }, { clock: '25:00' },
    { createdAt: -1 }, { preset: 'constructor' }, { preset: '__proto__' },
  ]) assert.throws(() => Collection.parseImport(backupWith([photo(changes)])), JSON.stringify(changes).slice(0, 100));
});

test('local album recovery skips damaged entries and copies only independent photo fields', () => {
  const original = photo({ extra: { nested: 'ignored' } });
  const cleaned = Roaming.cleanPhotos([original, photo({ id: 'broken', image: 'bad' }), original, photo({ id: 'photo-b' })]);
  assert.equal(cleaned.length, 2); assert.equal(cleaned[0].extra, undefined);
  cleaned[0].note = 'changed'; assert.equal(original.note, '晚风刚刚好。');
  assert.equal(Roaming.cleanPhotos(Array.from({ length: 25 }, (_, i) => photo({ id: String(i) }))).length, 20);
  assert.throws(() => Roaming.validatePhotos({}));
});
