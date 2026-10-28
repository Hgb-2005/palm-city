const { test } = require('node:test');
const assert = require('node:assert/strict');
const Stories = require('../city-stories.js');
const Life = require('../city-life.js');
const Collection = require('../city-collection.js');

function street() {
  return [
    { id: 1, type: 'house', x: -144, y: -84 },
    { id: 2, type: 'house', x: -48, y: -84 },
    { id: 3, type: 'house', x: 48, y: -84 },
    { id: 4, type: 'shop', x: 144, y: -84 },
    ...[-144, -96, -48, 0, 48, 96, 144].map((x, i) => ({ id: 10 + i, type: 'road', x, y: 12 })),
    ...[-144, -48, 48, 144].map((x, i) => ({ id: 20 + i, type: 'road', x, y: -36 })),
    { id: 100, type: 'bench', x: 0, y: 60 },
    { id: 101, type: 'tree', x: -48, y: 108 },
    { id: 102, type: 'lamp', x: 60, y: 96 },
    { id: 103, type: 'garden', x: 96, y: 60 },
    { id: 104, type: 'pavilion', x: -96, y: 60 },
    { id: 105, type: 'plaza', x: -240, y: 12 },
    { id: 106, type: 'road', x: -192, y: 12 },
  ];
}
const bloom = [{ id: 103, planted: true, growth: 1 }];
function make(season, gardens = bloom, saved = {}) {
  const simulation = Life.createSimulation(saved);
  simulation.sync(street()); simulation.setStoryContext({ season, gardens });
  simulation.setNight(season === 'winter'); return simulation;
}
function advance(sim, seconds) { for (let i = 0; i < seconds * 10; i++) sim.tick(.1); }
function waitFor(sim, predicate, limit = 100) {
  for (let i = 0; i < limit * 10 && !predicate(); i++) sim.tick(.1);
  assert.ok(predicate(), 'expected real resident state before timeout');
}

test('each season waits for acceptance, a real road journey and a sustained visit', () => {
  for (const season of Object.keys(Stories.chapters)) {
    const sim = make(season);
    advance(sim, 60); assert.equal(sim.story().status, 'available');
    assert.ok(sim.acceptStory()); assert.equal(sim.acceptStory(), false);
    assert.equal(sim.progress().stories[0].completed, false);
    const resident = sim.residents.find(r => r.id === sim.story().residentId);
    assert.equal(sim.story().status, 'ready');
    waitFor(sim, () => resident.phase === 'resting' && resident.plan?.storyId === season);
    assert.equal(sim.story().status, 'visiting');
    assert.equal(sim.progress().stories[0].completed, false);
    assert.ok(resident.route.filter(point => point.roadId).length > 0);
    advance(sim, 1); assert.equal(sim.progress().stories[0].completed, false);
    advance(sim, 1.2); assert.equal(sim.story().status, 'completed');
    const events = sim.drainEvents().filter(e => e.kind === 'story');
    assert.equal(events.length, 1); assert.equal(events[0].id, `story:${season}`);
    assert.equal(sim.speech(resident), Stories.chapters[season].thanks);
    if (season === 'spring') assert.equal(sim.moment(resident), 'watching');
    else if (season === 'winter') assert.equal(sim.moment(resident), 'tea');
    else assert.ok(['reading', 'tea'].includes(sim.moment(resident)));
    advance(sim, 150); assert.equal(sim.drainEvents().filter(e => e.kind === 'story').length, 0);
  }
});

test('spring requires a living garden to bloom and ignores detached saved plots', () => {
  const sim = make('spring', [{ id: 103, planted: true, growth: .99 }]); sim.acceptStory();
  advance(sim, 80); assert.equal(sim.story().ready, false); assert.equal(sim.story().status, 'preparing');
  sim.setStoryContext({ season: 'spring', gardens: bloom });
  waitFor(sim, () => sim.story().status === 'completed');
  const detached = make('spring', [{ id: 999, planted: true, growth: 1 }]);
  assert.equal(detached.story().ready, false);
});

test('winter needs both a nearby light and actual night and always uses a tea pose', () => {
  const sim = make('winter'); sim.setNight(false); sim.acceptStory();
  advance(sim, 80); assert.equal(sim.story().ready, false);
  sim.setNight(true); waitFor(sim, () => sim.story().status === 'completed');
  assert.equal(sim.moment(sim.residents.find(r => r.plan?.storyId === 'winter')), 'tea');
});

test('removing roads, shade, lights or moving a target before a visit prevents false completion', () => {
  for (const [season, edit] of [
    ['summer', items => items.filter(i => i.id !== 101)],
    ['autumn', items => items.filter(i => i.id !== 100)],
    ['winter', items => items.filter(i => i.id !== 102)],
    ['spring', items => items.map(i => i.id === 103 ? { ...i, x: 700 } : i)],
    ['summer', items => items.filter(i => i.id !== 13)],
  ]) {
    const sim = make(season); sim.acceptStory();
    const resident = sim.residents.find(r => r.id === sim.story().residentId);
    waitFor(sim, () => resident.phase === 'resting' && resident.plan?.storyId === season);
    sim.sync(edit(street())); advance(sim, 80);
    assert.equal(sim.progress().stories[0].completed, false, season);
    assert.equal(sim.drainEvents().some(e => e.kind === 'story'), false);
    sim.sync(street()); waitFor(sim, () => sim.story().status === 'completed');
  }
});

test('rain interrupts a story, preserves its promise and waits for a complete visit after sunshine', () => {
  const sim = make('autumn'); sim.acceptStory();
  waitFor(sim, () => sim.residents.some(r => r.plan?.storyId === 'autumn' && r.phase === 'resting'));
  sim.setWeather('rain'); advance(sim, 70);
  assert.equal(sim.story().status, 'preparing'); assert.equal(sim.progress().stories[0].completed, false);
  assert.equal(sim.drainEvents().some(e => e.kind === 'story'), false);
  sim.setWeather('sunny'); waitFor(sim, () => sim.story().status === 'completed');
});

test('switching away suspends an unfinished chapter, returning continues and completed chapters never repeat', () => {
  const sim = make('summer'); sim.acceptStory(); advance(sim, 1.5);
  sim.setStoryContext({ season: 'autumn', gardens: bloom }); advance(sim, 70);
  assert.equal(sim.progress().stories.find(e => e.season === 'summer').completed, false);
  assert.equal(sim.story().status, 'available'); sim.acceptStory();
  waitFor(sim, () => sim.story().status === 'completed');
  sim.setStoryContext({ season: 'summer', gardens: bloom }); waitFor(sim, () => sim.story().status === 'completed');
  assert.equal(sim.progress().stories.filter(e => e.completed).length, 2);
  sim.drainEvents(); sim.setStoryContext({ season: 'autumn', gardens: bloom }); advance(sim, 120);
  assert.equal(sim.drainEvents().some(e => e.kind === 'story'), false);
});

test('a shared bench is used by one resident at a time and respects a visitor reservation', () => {
  const sim = make('summer'); sim.acceptStory(); sim.setReservedFacilities([100]);
  advance(sim, 100); assert.equal(sim.story().status, 'ready');
  assert.equal(sim.residents.some(r => r.plan?.storyId && r.phase === 'resting'), false);
  sim.setReservedFacilities([]);
  for (let i = 0; i < 1500; i++) {
    sim.tick(.1);
    assert.ok(sim.residents.filter(r => r.plan?.targetId === 100 && ['outbound', 'resting'].includes(r.phase)).length <= 1);
  }
  assert.equal(sim.story().status, 'completed');
});

test('original wishes finish before a story assigned to the same neighbor', () => {
  const sim = make('summer'); sim.acceptWish('shade:1'); sim.acceptStory();
  waitFor(sim, () => sim.progress().completed.includes('shade:1'));
  waitFor(sim, () => sim.story().status === 'completed', 180);
  assert.ok(sim.progress().completed.includes('shade:1'));
});

test('unrelated resident updates preserve a completed story thank-you and return journey', () => {
  const sim = make('summer'); sim.acceptStory(); waitFor(sim, () => sim.story().status === 'completed');
  const resident = sim.residents.find(r => r.plan?.storyId === 'summer');
  const position = { x: resident.x, y: resident.y };
  sim.setNight(true);
  assert.deepEqual({ x: resident.x, y: resident.y }, position);
  assert.equal(sim.speech(resident), Stories.chapters.summer.thanks);
  waitFor(sim, () => resident.phase === 'returning');
  waitFor(sim, () => resident.phase === 'home');
});

test('daybreak interrupts an unfinished winter visit; undoing layout edits never erases completed stories', () => {
  const sim = make('winter'); sim.acceptStory();
  waitFor(sim, () => sim.residents.some(r => r.plan?.storyId === 'winter' && r.phase === 'resting'));
  sim.setNight(false); advance(sim, 80);
  assert.equal(sim.progress().stories[0].completed, false);
  sim.setNight(true); waitFor(sim, () => sim.story().status === 'completed');
  sim.drainEvents(); sim.sync(street().filter(i => i.id !== 100)); advance(sim, 20);
  sim.sync(street()); advance(sim, 100);
  assert.equal(sim.story().status, 'completed');
  assert.equal(sim.drainEvents().some(e => e.kind === 'story'), false);
});

test('pending stories survive refresh and a removed home can pass the promise to a remaining neighbor', () => {
  const sim = make('spring', []); sim.acceptStory();
  const restored = make('spring', bloom, sim.progress());
  assert.equal(restored.story().status, 'ready');
  const owner = restored.story().homeId;
  restored.sync(street().filter(i => i.id !== owner));
  waitFor(restored, () => restored.story().status === 'completed');
  assert.notEqual(restored.progress().stories[0].homeId, owner);
});

test('completed and pending chapters roundtrip through backup and city copies independently', () => {
  const sim = make('autumn'); sim.acceptStory(); waitFor(sim, () => sim.story().status === 'completed');
  sim.setStoryContext({ season: 'spring', gardens: [] }); sim.acceptStory();
  const data = { ...Collection.buildTemplate('forest'), season: 'spring', progress: sim.progress(), journal: sim.drainEvents().map(e => ({ ...e, createdAt: 1, clock: '09:00' })) };
  const source = Collection.makeRecord(data), imported = Collection.parseImport(JSON.stringify(Collection.exportFile(source)));
  assert.deepEqual(imported.data.progress.stories, source.data.progress.stories);
  const copy = Collection.makeRecord(imported.data); copy.data.progress.stories[0].completed = false;
  assert.equal(source.data.progress.stories[0].completed, true);
  const restored = make('autumn', bloom, imported.data.progress); advance(restored, 150);
  assert.equal(restored.drainEvents().some(e => e.kind === 'story'), false);
});

test('old towns begin with no stories; malformed local progress is cleaned and invalid backups are rejected', () => {
  assert.deepEqual(Life.cleanProgress().stories, []);
  assert.equal(Life.createSimulation().acceptStory(), false);
  assert.deepEqual(Stories.cleanProgress([{ season: '__proto__', homeId: 1 }, { season: 'spring', homeId: 1, completed: true }, { season: 'spring', homeId: 2 }]), [{ season: 'spring', homeId: 1, completed: true }]);
  for (const stories of [null, {}, [{ season: 'fake', homeId: 1, completed: false }], [{ season: 'spring', homeId: 1 }], [{ season: 'spring', homeId: '1', completed: false }], [{ season: 'spring', homeId: 1, completed: false }, { season: 'spring', homeId: 2, completed: false }]]) {
    const data = Collection.buildTemplate('empty'); data.progress.stories = stories;
    assert.throws(() => Collection.parseImport(JSON.stringify(data)), /故事/);
  }
});
