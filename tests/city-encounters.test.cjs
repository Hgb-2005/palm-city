const test = require('node:test');
const assert = require('node:assert/strict');
const Encounters = require('../city-encounters.js');
const Life = require('../city-life.js');

const item = (id, type, x, y, rotate = 0) => ({ id, type, x, y, rotate });
const town = () => [
  item(1, 'house', 0, -84),
  item(2, 'road', 0, -36),
  item(3, 'road', 0, 12),
  item(4, 'road', 48, 12),
  item(5, 'pavilion', 0, 60),
  item(6, 'shop', 48, 60),
  item(7, 'tree', -40, 72),
  item(8, 'bench', -48, 60),
  item(9, 'lamp', -96, 60),
];

function context(items = town(), options = {}) {
  const simulation = Life.createSimulation();
  simulation.sync(items);
  return {
    items,
    residents: () => simulation.residents,
    simulation,
    date: options.date || '2026-11-11',
    raining: !!options.raining,
    night: !!options.night,
  };
}

test('the day scene is deterministic and follows the current weather mood', () => {
  const rainy = context(town(), { raining: true });
  const first = Encounters.createEncounters();
  const second = Encounters.createEncounters();
  assert.deepEqual(first.current(rainy), second.current(rainy));
  assert.equal(first.current(rainy).kind, 'rain');
  assert.match(first.current(rainy).id, /2026-11-11:rain:/);
  assert.equal(Encounters.createEncounters().current(context(town(), { night: true })).kind, 'night');
  assert.equal(Encounters.createEncounters().current(context()).kind, 'sunny');
});

test('options describe real targets and expose a broken route without inventing access', () => {
  const items = [item(1, 'house', 0, -84), item(2, 'pavilion', 0, 60), item(3, 'shop', 96, 60)];
  const scene = Encounters.createEncounters();
  const input = context(items, { raining: true });
  const options = scene.options(input);
  assert.equal(options.find(option => option.id === 'pavilion').available, false);
  assert.match(options.find(option => option.id === 'pavilion').reason, /接通小路/);
  const attempt = scene.select('pavilion', input);
  assert.equal(attempt.ok, false);
  assert.equal(scene.active.status, 'offered');
});

test('choosing a scene records the actual destination and can only complete once', () => {
  const input = context(town(), { raining: true });
  const scene = Encounters.createEncounters();
  const option = scene.options(input).find(entry => entry.id === 'pavilion');
  assert.equal(option.available, true);
  assert.equal(option.targetId, 5);
  const chosen = scene.select('pavilion', input);
  assert.equal(chosen.ok, true);
  assert.equal(scene.active.status, 'chosen');
  assert.equal(scene.active.targetId, 5);
  assert.equal(scene.active.choiceLabel, '去凉亭听雨');
  const remembered = scene.complete({ title: '雨落在凉亭上', text: '小林真的走到了凉亭。', createdAt: 10 });
  assert.equal(remembered.id, 'scene:2026-11-11:rain:1');
  assert.equal(scene.active, null);
  assert.equal(scene.history().length, 1);
  assert.equal(scene.complete({ title: '重复' }), null);
});

test('a completed day stays complete on reload and the next day begins another scene', () => {
  const input = context();
  const first = Encounters.createEncounters();
  first.select('shop', input);
  first.complete({ text: '走到了商店。' });
  const saved = first.save();
  const restored = Encounters.createEncounters(saved);
  assert.equal(restored.current(input), null);
  assert.equal(restored.today(input).date, '2026-11-11');
  const tomorrow = { ...input, date: '2026-11-12' };
  assert.equal(restored.current(tomorrow).date, '2026-11-12');
  assert.notEqual(restored.current(tomorrow).id, saved.history[0].id);
});

test('bad and old encounter data are discarded without touching the city', () => {
  const items = town();
  const before = JSON.stringify(items);
  const scene = Encounters.createEncounters({
    active: { id: 'broken', kind: 'unknown', status: 'chosen' },
    history: [{ id: 'bad', date: 'not-a-date', kind: 'rain', choiceId: 'pavilion', createdAt: 1 }],
  });
  assert.equal(scene.active, null);
  assert.deepEqual(scene.history(), []);
  assert.equal(scene.current({ items, residents: [], date: '2026-11-11' }), null);
  assert.equal(JSON.stringify(items), before);
});

test('a resident reaches the selected place before a scene memory is emitted', () => {
  const input = context(town(), { raining: true });
  const scene = Encounters.createEncounters();
  const option = scene.options(input).find(entry => entry.id === 'pavilion');
  scene.select(option.id, input);
  const resident = input.residents().find(entry => entry.id === scene.active.residentId);
  const started = input.simulation.startEncounter({
    ...scene.active,
    choiceLabel: option.label,
    title: '雨落下来之前',
    text: `${resident.name}走到了凉亭。`,
    quote: '屋檐把雨声收得很好听。',
  });
  assert.equal(started, true);
  assert.equal(resident.visible, true);
  assert.equal(resident.phase, 'encounter-outbound');
  let memory = null;
  for (let index = 0; index < 500 && !memory; index++) {
    input.simulation.tick(.1);
    memory = input.simulation.drainEvents().find(event => event.kind === 'encounter') || null;
  }
  assert.ok(memory);
  assert.equal(memory.id, scene.active.id);
  assert.equal(memory.title, '雨落下来之前');
  assert.equal(scene.active.status, 'chosen');
});

test('scene state is isolated when a city is copied or switched', () => {
  const sourceInput = context(town(), { raining: true });
  const source = Encounters.createEncounters();
  source.select('pavilion', sourceInput);
  source.complete({ title: '原城的一幕' });
  const copy = Encounters.createEncounters(source.save());
  assert.equal(copy.history()[0].title, '原城的一幕');
  copy.restore({});
  assert.equal(copy.history().length, 0);
  assert.equal(source.history().length, 1);
});

test('an older city without encounter data starts cleanly and keeps its scene data across a backup', () => {
  const input = context(town(), { night: true });
  const opening = Encounters.createEncounters({ schema: 7, items: town() });
  assert.equal(opening.current(input).kind, 'night');
  opening.select('pavilion', input);
  opening.complete({ title: '夜色里的凉亭', text: '阿禾在灯光下站了一会儿。', createdAt: 88 });

  const saved = opening.save();
  const restored = Encounters.createEncounters(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.current(input), null);
  assert.equal(restored.today(input).title, '夜色里的凉亭');
  assert.equal(restored.history()[0].createdAt, 88);
});

test('a chosen journey survives refresh and can resume from the saved destination', () => {
  const input = context(town(), { raining: true });
  const original = Encounters.createEncounters();
  original.select('pavilion', input);
  const restored = Encounters.createEncounters(original.save());
  const active = restored.current(input);
  assert.equal(active.status, 'chosen');
  assert.equal(active.targetId, 5);

  const simulation = Life.createSimulation();
  simulation.sync(input.items);
  const resumed = simulation.startEncounter({
    ...active,
    title: '雨落下来之前',
    text: '小林来到了凉亭。',
    quote: '这里听雨，刚刚好。',
  });
  assert.equal(resumed, true);
  assert.equal(simulation.hasEncounterJourney(), true);
});

test('a removed destination reopens the offered scene without inventing another route', () => {
  const input = context(town(), { raining: true });
  const scene = Encounters.createEncounters();
  scene.select('pavilion', input);
  const changed = { ...input, items: town().filter(entry => entry.type !== 'pavilion') };

  assert.equal(scene.current(changed).status, 'chosen');
  assert.equal(scene.options(changed).find(entry => entry.id === 'pavilion').available, false);
  assert.equal(scene.reopen(), true);
  assert.equal(scene.current(changed).status, 'offered');
  assert.equal(scene.active.targetId, null);
});

test('an accepted scene continues after midnight while the next day waits', () => {
  const input = context(town(), { raining: true });
  const scene = Encounters.createEncounters();
  scene.select('pavilion', input);
  const afterMidnight = { ...input, date: '2026-11-12' };
  assert.equal(scene.current(afterMidnight).date, '2026-11-11');
  assert.equal(scene.current(afterMidnight).status, 'chosen');
});

test('cancelling a walk sends the resident home and emits no scene memory', () => {
  const input = context(town(), { raining: true });
  const scene = Encounters.createEncounters();
  const option = scene.options(input).find(entry => entry.id === 'pavilion');
  scene.select(option.id, input);
  const resident = input.residents().find(entry => entry.id === scene.active.residentId);
  input.simulation.startEncounter({
    ...scene.active,
    choiceLabel: option.label,
    title: '没走完的一幕',
    text: '这一幕不应该被写下。',
  });
  assert.equal(input.simulation.cancelEncounter(), true);
  assert.equal(input.simulation.hasEncounterJourney(), false);
  assert.equal(resident.phase, 'home');
  for (let index = 0; index < 80; index++) input.simulation.tick(.1);
  assert.equal(input.simulation.drainEvents().some(event => event.kind === 'encounter'), false);
});

test('weather changes never interrupt an accepted scene or duplicate its memory', () => {
  const input = context(town());
  const scene = Encounters.createEncounters();
  const option = scene.options(input).find(entry => entry.id === 'shop');
  scene.select(option.id, input);
  const resident = input.residents().find(entry => entry.id === scene.active.residentId);
  input.simulation.startEncounter({
    ...scene.active,
    choiceLabel: option.label,
    title: '风把街角吹得很轻',
    text: `${resident.name}沿小路走到了商店。`,
  });

  input.simulation.setWeather(true);
  let encounters = [];
  for (let index = 0; index < 500; index++) {
    input.simulation.tick(.1);
    encounters.push(...input.simulation.drainEvents().filter(event => event.kind === 'encounter'));
  }
  assert.equal(encounters.length, 1);
  assert.equal(encounters[0].id, scene.active.id);
  assert.equal(input.simulation.hasEncounterJourney(), false);
});
