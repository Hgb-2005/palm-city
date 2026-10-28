const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSimulation, createNetwork, findRoute } = require("../city-life.js");

function street() {
  return [
    { id: 1, type: "house", x: -144, y: -84 },
    { id: 2, type: "house", x: -48, y: -84 },
    { id: 3, type: "house", x: 48, y: -84 },
    { id: 4, type: "shop", x: 144, y: -84 },
    ...[-144, -96, -48, 0, 48, 96, 144].map((x, index) => ({ id: 10 + index, type: "road", x, y: 12 })),
    ...[-144, -48, 48, 144].map((x, index) => ({ id: 20 + index, type: "road", x, y: -36 })),
  ];
}
function advance(simulation, seconds) {
  for (let i = 0; i < seconds * 10; i++) simulation.tick(.1);
}

test("all three homes connect through cardinal road neighbors to a shop", () => {
  const items = street();
  const network = createNetwork(items);
  const shops = items.filter((item) => item.type === "shop");
  for (const home of items.filter((item) => item.type === "house")) {
    const route = findRoute(home, shops, network);
    assert.equal(route.shopId, 4);
    const roads = route.points.filter((point) => point.roadId);
    for (let i = 1; i < roads.length; i++) assert.equal(Math.abs(roads[i].x - roads[i - 1].x) + Math.abs(roads[i].y - roads[i - 1].y), 48);
  }
});

test("a resident goes shopping and returns home without leaving the road route", () => {
  const simulation = createSimulation();
  simulation.sync(street());
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    simulation.tick(.1);
    seen.add(simulation.residents[0].phase);
    for (const resident of simulation.residents) assert.ok(Number.isFinite(resident.x) && Number.isFinite(resident.y));
  }
  assert.ok(seen.has("outbound") && seen.has("shopping") && seen.has("returning") && seen.has("home"));
  assert.ok(simulation.residents[0].trips >= 1);
});

test("deleting a road during a trip invalidates the journey, reconnecting resumes it", () => {
  const items = street();
  const simulation = createSimulation();
  simulation.sync(items);
  advance(simulation, 3);
  assert.equal(simulation.residents[0].phase, "outbound");
  simulation.sync(items.filter((item) => item.id !== 13));
  assert.equal(simulation.residents[0].plan, null);
  assert.equal(simulation.residents[0].visible, false);
  advance(simulation, 30);
  assert.equal(simulation.residents[0].phase, "home");
  simulation.sync(items);
  advance(simulation, 3);
  assert.equal(simulation.residents[0].phase, "outbound");
});

test("moving buildings replans safely, undoing their movement restores the trip", () => {
  const items = street();
  const simulation = createSimulation();
  simulation.sync(items);
  advance(simulation, 3);
  simulation.sync(items.map((item) => item.id === 4 ? { ...item, x: 360, y: -192 } : item));
  assert.ok(simulation.residents.every((resident) => !resident.plan && !resident.visible));
  simulation.sync(items);
  advance(simulation, 60);
  assert.ok(simulation.residents.every((resident) => resident.trips > 0));
});

test("residents replan through an alternate street after the main road is removed", () => {
  const items = street();
  const simulation = createSimulation();
  simulation.sync(items);
  advance(simulation, 3);
  const bypass = [-48, 0, 48].map((x, index) => ({ id: 100 + index, type: "road", x, y: 60 }));
  simulation.sync([...items.filter((item) => item.id !== 13), ...bypass]);
  const plan = simulation.residents[0].plan;
  assert.ok(plan);
  assert.ok(plan.points.some((point) => point.y === 60));
  assert.ok(plan.points.every((point) => point.roadId !== 13));
  advance(simulation, 90);
  assert.ok(simulation.residents[0].trips > 0);
});

test("unconnected homes, missing shops, empty cities, and the five-person limit", () => {
  const simulation = createSimulation();
  simulation.sync([{ id: 1, type: "house", x: 0, y: 0 }]);
  advance(simulation, 60);
  assert.equal(simulation.residents[0].visible, false);
  assert.equal(simulation.activity(simulation.residents[0]), "等小商店开张");
  simulation.sync(Array.from({ length: 8 }, (_, index) => ({ id: index + 1, type: "house", x: index * 48, y: 0 })));
  assert.equal(simulation.residents.length, 5);
  assert.equal(new Set(simulation.residents.map((resident) => resident.name)).size, 5);
  simulation.sync([]);
  assert.equal(simulation.residents.length, 0);
});

test("choose a reachable shop when a nearer shop is disconnected", () => {
  const items = street();
  const home = items[0];
  const isolatedShop = { id: 99, type: "shop", x: -240, y: -84 };
  const route = findRoute(home, [isolatedShop, items[3]], createNetwork(items));
  assert.equal(route.shopId, 4);
});

function park() {
  return [...street(), { id: 101, type: "bench", x: -96, y: 60 }, { id: 102, type: "tree", x: -168, y: 96 }];
}

test("shade wish requires a bench beside a tree and a connected road from home", () => {
  const simulation = createSimulation();
  simulation.sync(street());
  assert.equal(simulation.wishes()[0].ready, false);
  simulation.sync([...street(), { id: 101, type: "bench", x: -96, y: 60 }]);
  assert.equal(simulation.wishes()[0].ready, false);
  simulation.sync(park());
  assert.equal(simulation.wishes()[0].ready, true);
  simulation.sync(park().filter((item) => item.type !== "road"));
  assert.equal(simulation.wishes()[0].ready, false);
});

test("a wish completes only after its resident arrives and sits for a while", () => {
  const simulation = createSimulation();
  simulation.sync(park());
  assert.equal(simulation.acceptWish("shade:1"), true);
  assert.equal(simulation.acceptWish("shade:1"), false);
  assert.equal(simulation.progress().completed.length, 0);
  for (let i = 0; i < 600 && simulation.residents[0].phase !== "resting"; i++) simulation.tick(.1);
  assert.equal(simulation.residents[0].phase, "resting");
  assert.equal(simulation.progress().completed.length, 0);
  advance(simulation, 2.2);
  assert.ok(simulation.progress().completed.includes("shade:1"));
  const memory = simulation.drainEvents().find((event) => event.wishId === "shade:1");
  assert.match(memory.text, /小林.*树下的长椅/);
  assert.match(simulation.speech(simulation.residents[0]), /谢谢/);
});

test("removing a bench, tree, or connecting road cancels an unfulfilled outing", () => {
  for (const removedId of [101, 102, 20]) {
    const simulation = createSimulation();
    simulation.sync(park());
    simulation.acceptWish("shade:1");
    advance(simulation, 1.5);
    simulation.sync(park().filter((item) => item.id !== removedId));
    advance(simulation, 35);
    assert.equal(simulation.progress().completed.includes("shade:1"), false, `removed ${removedId}`);
    assert.equal(simulation.drainEvents().some((event) => event.wishId === "shade:1"), false);
    simulation.sync(park());
    advance(simulation, 50);
    assert.ok(simulation.progress().completed.includes("shade:1"));
  }
});

test("removing shade before a seated resident has rested cannot complete the wish", () => {
  const simulation = createSimulation();
  simulation.sync(park()); simulation.acceptWish("shade:1");
  while (simulation.residents[0].phase !== "resting") simulation.tick(.1);
  simulation.sync(park().filter((item) => item.type !== "tree"));
  advance(simulation, 30);
  assert.equal(simulation.progress().completed.length, 0);
});

test("lamplight wish waits for night and an actual visit to a lit bench", () => {
  const items = [...street(), { id: 101, type: "bench", x: 48, y: 60 }, { id: 103, type: "lamp", x: 108, y: 60 }];
  const simulation = createSimulation();
  simulation.sync(items); simulation.acceptWish("lamplight:3");
  advance(simulation, 70);
  assert.equal(simulation.wishes()[2].ready, false);
  assert.equal(simulation.progress().completed.length, 0);
  simulation.setNight(true);
  advance(simulation, 40);
  assert.ok(simulation.progress().completed.includes("lamplight:3"));
});

test("square wish requires two neighbors to arrive at the same reachable square", () => {
  const simulation = createSimulation();
  simulation.sync([...street(), { id: 110, type: "plaza", x: -48, y: 60 }]);
  simulation.acceptWish("meeting:2");
  advance(simulation, 35);
  assert.ok(simulation.progress().completed.includes("meeting:2"));
  const memory = simulation.drainEvents().filter((event) => event.kind === "meeting");
  assert.equal(memory.length, 1);
  assert.match(memory[0].text, /阿禾和小林/);
  advance(simulation, 100);
  assert.equal(simulation.drainEvents().some((event) => event.wishId === "meeting:2"), false);
});

test("a disconnected companion prevents a square wish, reconnecting enables it", () => {
  const items = [...street().filter((item) => item.type !== "house" || item.id === 2), { id: 1, type: "house", x: -360, y: -180 }, { id: 110, type: "plaza", x: -48, y: 60 }];
  const simulation = createSimulation();
  simulation.sync(street());
  simulation.sync(items); simulation.acceptWish("meeting:2");
  advance(simulation, 40);
  assert.equal(simulation.progress().completed.length, 0);
  assert.equal(simulation.wishes().find((wish) => wish.id === "meeting:2").ready, false);
  simulation.sync([...street(), { id: 110, type: "plaza", x: -48, y: 60 }]);
  advance(simulation, 40);
  assert.ok(simulation.progress().completed.includes("meeting:2"));
});

test("three accepted wishes can share residents and still complete in turn", () => {
  const simulation = createSimulation();
  simulation.sync([...park(), { id: 103, type: "lamp", x: -36, y: 60 }, { id: 110, type: "plaza", x: 48, y: 60 }]);
  simulation.setNight(true);
  for (const wish of simulation.wishes()) simulation.acceptWish(wish.id);
  advance(simulation, 160);
  assert.equal(simulation.progress().completed.length, 3);
});

test("restoring saved wishes keeps completed memories from being emitted again", () => {
  const original = createSimulation();
  original.sync(park()); original.acceptWish("shade:1"); advance(original, 30);
  const saved = original.progress();
  const restored = createSimulation(saved);
  restored.sync(park());
  assert.equal(restored.wishes()[0].status, "completed");
  advance(restored, 60);
  assert.equal(restored.drainEvents().some((event) => event.wishId === "shade:1"), false);
});

test("one bench never has two seated residents at once", () => {
  const simulation = createSimulation();
  simulation.sync(park());
  simulation.acceptWish("shade:1");
  for (let i = 0; i < 1800; i++) {
    simulation.tick(.1);
    assert.ok(simulation.residents.filter((resident) => resident.phase === "resting").length <= 1);
  }
});

test("bad persisted progress and unknown wish IDs are ignored", () => {
  const simulation = createSimulation({ accepted: ["shade:1", "shade:1", null, "<script>"], completed: "bad" });
  simulation.sync(park());
  assert.deepEqual(simulation.progress().accepted, ["shade:1"]);
  assert.equal(simulation.acceptWish("shade:99"), false);
  simulation.sync([]);
  assert.deepEqual(simulation.wishes(), []);
});

test("residents keep their names and wishes after a home is removed and the city reloads", () => {
  const original = createSimulation();
  original.sync(street());
  const remaining = street().filter((item) => item.id !== 1);
  original.sync(remaining);
  original.acceptWish("meeting:2");
  const restored = createSimulation(original.progress());
  restored.sync(remaining);
  assert.equal(restored.residents[0].name, "阿禾");
  assert.equal(restored.wishes()[0].id, "meeting:2");
  assert.equal(restored.wishes()[0].status, "preparing");
});
