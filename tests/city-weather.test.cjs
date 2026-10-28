const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createEnvironment } = require("../city-weather.js");
const { createSimulation } = require("../city-life.js");

function advance(simulation, seconds) {
  for (let index = 0; index < seconds * 10; index++) simulation.tick(.1);
}

const plot = { id: 91, type: "garden", x: 0, y: 100 };
function environment() {
  const value = createEnvironment();
  value.sync([plot]); value.setAuto(false);
  return value;
}

function street() {
  return [
    { id: 1, type: "house", x: -144, y: -84 },
    { id: 2, type: "house", x: -48, y: -84 },
    { id: 3, type: "house", x: 48, y: -84 },
    { id: 4, type: "shop", x: 144, y: -84 },
    ...[-144, -96, -48, 0, 48, 96, 144].map((x, index) => ({ id: 10 + index, type: "road", x, y: 12 })),
    ...[-144, -48, 48, 144].map((x, index) => ({ id: 20 + index, type: "road", x, y: -36 })),
    { id: 90, type: "pavilion", x: -48, y: 60 },
  ];
}

test("empty plots and dry seeds wait without growing; manual watering enables every growth stage", () => {
  const value = environment();
  advance(value, 90); assert.equal(value.garden(91).stage, "empty");
  assert.equal(value.water(91), false);
  assert.equal(value.sow(91), true); assert.equal(value.sow(91), false);
  advance(value, 90); assert.equal(value.garden(91).growth, 0);
  assert.equal(value.water(91), true); assert.equal(value.water(91), false);
  advance(value, 13); assert.equal(value.garden(91).stage, "sprout");
  advance(value, 16); assert.equal(value.garden(91).stage, "bud");
  advance(value, 13); assert.equal(value.garden(91).stage, "bloom");
  assert.equal(value.drainEvents().length, 1);
  advance(value, 150); assert.equal(value.drainEvents().length, 0);
  assert.equal(value.garden(91).stage, "bloom");
});

test("rain waters seeds, waits for sunshine to bloom, and records only one first rain-bloom", () => {
  const value = environment();
  value.sync([plot, { ...plot, id: 92, x: 100 }]);
  value.sow(91); value.sow(92); value.setWeather("rain");
  advance(value, 55);
  assert.equal(value.garden(91).growth, .9);
  assert.equal(value.garden(91).rainFed, true);
  assert.equal(value.drainEvents().length, 0);
  value.setWeather("sunny"); advance(value, 5);
  assert.equal(value.garden(91).stage, "bloom");
  assert.equal(value.garden(92).stage, "bloom");
  assert.deepEqual(value.drainEvents().map((event) => event.id), ["first:rain-bloom"]);
  const restored = createEnvironment(value.save()); restored.sync([plot, { ...plot, id: 92 }]);
  advance(restored, 140); assert.equal(restored.drainEvents().length, 0);
});

test("starting rain never decreases a nearly open flower's progress", () => {
  const value = environment(); value.sow(91); value.water(91);
  advance(value, 38); const before = value.garden(91).growth;
  assert.ok(before > .9);
  value.setWeather("rain"); advance(value, 20);
  assert.equal(value.garden(91).growth, before);
  value.setWeather("sunny"); advance(value, 3);
  assert.equal(value.garden(91).stage, "bloom");
});

test("weather rotates automatically and can stay on rain while the garden still grows", () => {
  const value = createEnvironment(); value.sync([plot]); value.sow(91);
  advance(value, 91); assert.equal(value.weather.kind, "rain");
  value.setAuto(false); const before = value.weather.elapsed;
  advance(value, 60); assert.equal(value.weather.kind, "rain");
  assert.equal(value.weather.elapsed, before); assert.ok(value.garden(91).growth > .8);
  value.setAuto(true); advance(value, 45); assert.equal(value.weather.kind, "sunny");
  assert.equal(value.setWeather("snow"), false);
});

test("saving restores growth and moisture without applying time spent away", () => {
  const value = environment(); value.sow(91); value.water(91); advance(value, 14);
  const saved = JSON.parse(JSON.stringify(value.save()));
  const restored = createEnvironment(saved); restored.sync([plot]);
  assert.deepEqual(restored.garden(91), value.garden(91));
  assert.deepEqual(restored.weather, value.weather);
  advance(restored, 30); assert.equal(restored.garden(91).stage, "bloom");
});

test("moving and undoing removal preserve a flower; copying starts with empty soil", () => {
  const value = environment(); value.sow(91); value.water(91); advance(value, 16);
  const before = value.garden(91);
  value.sync([{ ...plot, x: 200, y: 100 }]); assert.deepEqual(value.garden(91), before);
  value.sync([]); advance(value, 50);
  value.sync([plot, { ...plot, id: 92 }]);
  assert.deepEqual(value.garden(91), before); assert.equal(value.garden(92).stage, "empty");
  assert.equal(value.sow(404), false);
});

test("invalid environment saves are normalized without breaking tick", () => {
  const value = createEnvironment({ weather: { kind: "snow", elapsed: Infinity }, gardens: [null, { id: 91, growth: -9, moisture: NaN, planted: true }] });
  value.sync([plot]); advance(value, 1);
  assert.equal(value.weather.kind, "sunny"); assert.equal(value.garden(91).growth, 0);
  value.restore(null); value.sync([plot]); value.tick(NaN);
  assert.equal(value.garden(91).stage, "empty");
});

test("rain interrupts walkers in place and leads them along connected roads into a pavilion", () => {
  const simulation = createSimulation(); simulation.sync(street()); advance(simulation, 5);
  const walker = simulation.residents.find((resident) => resident.visible);
  const position = { x: walker.x, y: walker.y };
  simulation.setWeather("rain");
  assert.equal(walker.x, position.x); assert.equal(walker.y, position.y);
  assert.equal(walker.phase, "rain-walk");
  const roads = walker.route.filter((point) => point.roadId);
  for (let index = 1; index < roads.length; index++) assert.equal(Math.abs(roads[index].x - roads[index - 1].x) + Math.abs(roads[index].y - roads[index - 1].y), 48);
  advance(simulation, 20);
  assert.ok(simulation.residents.some((resident) => resident.phase === "sheltered"));
  assert.ok(simulation.residents.every((resident) => ["sheltered", "home"].includes(resident.phase)));
  simulation.setWeather("sunny"); advance(simulation, 30);
  assert.ok(simulation.residents.some((resident) => ["outbound", "shopping", "returning"].includes(resident.phase)));
});

test("without a reachable pavilion, walkers return home and indoor residents wait for sunshine", () => {
  const simulation = createSimulation(); simulation.sync(street().filter((item) => item.type !== "pavilion"));
  advance(simulation, 5); simulation.setWeather("rain");
  assert.ok(simulation.residents.some((resident) => resident.phase === "rain-home"));
  advance(simulation, 30); assert.ok(simulation.residents.every((resident) => !resident.visible));
  const trips = simulation.residents.map((resident) => resident.trips);
  advance(simulation, 30); assert.deepEqual(simulation.residents.map((resident) => resident.trips), trips);
  simulation.setWeather("sunny"); advance(simulation, 10);
  assert.ok(simulation.residents.some((resident) => resident.visible));
});

test("a rain-interrupted wish waits until a complete visit after rain, with no false memory", () => {
  const simulation = createSimulation();
  simulation.sync([...street(), { id: 95, type: "bench", x: -144, y: 60 }, { id: 96, type: "tree", x: -220, y: 60 }]);
  simulation.acceptWish("shade:1");
  for (let index = 0; index < 300 && simulation.residents[0].phase !== "resting"; index++) simulation.tick(.1);
  assert.equal(simulation.residents[0].phase, "resting");
  simulation.setWeather("rain"); advance(simulation, 40);
  assert.equal(simulation.progress().completed.length, 0);
  assert.equal(simulation.drainEvents().length, 0);
  simulation.setWeather("sunny"); advance(simulation, 80);
  assert.ok(simulation.progress().completed.includes("shade:1"));
});

test("removing shelter or roads during rain invalidates the trip safely; undo restores the town", () => {
  for (const type of ["pavilion", "road"]) {
    const simulation = createSimulation(); simulation.sync(street()); advance(simulation, 5);
    simulation.setWeather("rain"); advance(simulation, 4);
    simulation.sync(street().filter((item) => item.type !== type)); advance(simulation, 20);
    assert.ok(simulation.residents.every((resident) => Number.isFinite(resident.x) && Number.isFinite(resident.y)));
    assert.ok(simulation.residents.every((resident) => !resident.visible));
    simulation.sync(street()); simulation.setWeather("sunny"); advance(simulation, 10);
    assert.ok(simulation.residents.some((resident) => resident.visible));
  }
});

test("nightfall and new wishes preserve a shelter visit; sunshine resumes outstanding wishes", () => {
  const simulation = createSimulation();
  simulation.sync([...street(), { id: 95, type: "bench", x: -144, y: 60 }, { id: 96, type: "tree", x: -220, y: 60 }]);
  advance(simulation, 5); simulation.setWeather("rain"); advance(simulation, 20);
  const before = simulation.residents.map(({ x, y, phase }) => ({ x, y, phase }));
  assert.ok(before.some((resident) => resident.phase === "sheltered"));
  simulation.setNight(true); simulation.acceptWish("shade:1");
  assert.deepEqual(simulation.residents.map(({ x, y, phase }) => ({ x, y, phase })), before);
  simulation.setWeather("sunny"); advance(simulation, 80);
  assert.ok(simulation.progress().completed.includes("shade:1"));
});
