const { test } = require("node:test");
const assert = require("node:assert/strict");
const Visitors = require("../city-visitors.js");
const Life = require("../city-life.js");

function town() {
  return [
    { id: 1, type: "dock", x: -240, y: 12 },
    ...[-192, -144, -96, -48, 0, 48, 96].map((x, i) => ({ id: i + 10, type: "road", x, y: 12 })),
    { id: 30, type: "garden", x: 96, y: 60 },
    { id: 31, type: "bench", x: -48, y: 60 },
    { id: 32, type: "tree", x: -96, y: 84 },
    { id: 33, type: "pavilion", x: 0, y: -36 },
  ];
}
const sunshine = { weather: "sunny", gardens: { 30: { stage: "bloom" } } };
function advance(sim, seconds) { for (let i = 0; i < seconds * 10; i++) sim.tick(.1); }
function until(sim, predicate, seconds = 100) {
  for (let i = 0; i < seconds * 10; i++) { if (predicate(sim.active)) return; sim.tick(.1); }
  assert.fail(`condition not reached: ${JSON.stringify(sim.active)}`);
}
function start(items = town(), context = sunshine) { const sim = Visitors.createSimulation(); sim.sync(items, context); assert.equal(sim.invite(), true); return sim; }

test("a complete visit arrives, follows streets, admires, photographs, rests, returns and sends one postcard", () => {
  const sim = start(), seen = new Set();
  for (let i = 0; i < 1100; i++) {
    sim.tick(.1); if (sim.active) {
      seen.add(sim.active.phase);
      const roads = sim.active.route.filter((p) => p.roadId != null);
      for (let j = 1; j < roads.length; j++) assert.equal(Math.abs(roads[j].x - roads[j - 1].x) + Math.abs(roads[j].y - roads[j - 1].y), 48);
    }
  }
  for (const phase of ["arriving", "walking", "admiring", "photographing", "resting", "returning", "leaving"]) assert.ok(seen.has(phase), phase);
  assert.equal(sim.active, null);
  const cards = sim.drainEvents().filter((event) => event.kind === "postcard");
  assert.equal(cards.length, 1); assert.deepEqual(cards[0].visited, { garden: true, photo: true, rest: true });
  advance(sim, 100); assert.equal(sim.drainEvents().length, 0);
  assert.equal(sim.invite(), true); advance(sim, 110);
  assert.equal(sim.drainEvents().find((event) => event.kind === "postcard").number, 2);
});

test("a dock must connect to roads; one invitation at a time; optional stops never fabricate visits", () => {
  const sim = Visitors.createSimulation(); sim.sync([{ id: 1, type: "dock", x: -240, y: 12 }]);
  assert.equal(sim.invite(), false);
  sim.sync(town().filter((item) => !["garden", "bench"].includes(item.type)));
  assert.equal(sim.invite(), true); assert.equal(sim.invite(), false);
  advance(sim, 60);
  assert.deepEqual(sim.drainEvents().find((event) => event.kind === "postcard").visited, { garden: false, photo: false, rest: false });
});

test("rain interrupts in place, walks into a pavilion, then resumes the unfinished tour", () => {
  const items = town(), sim = start(items);
  advance(sim, 8); const position = { x: sim.active.x, y: sim.active.y };
  sim.sync(items, { ...sunshine, weather: "rain" });
  assert.equal(sim.active.phase, "rain-walk");
  assert.deepEqual({ x: sim.active.x, y: sim.active.y }, position);
  until(sim, (a) => a?.phase === "sheltered");
  assert.equal(sim.active.visited.garden, false);
  advance(sim, 10); assert.equal(sim.active.phase, "sheltered");
  sim.sync(items, sunshine); advance(sim, 100);
  const card = sim.drainEvents().find((event) => event.kind === "postcard");
  assert.equal(card.rainSeen, true); assert.equal(card.visited.rest, true); assert.equal(card.visited.photo, true);
});

test("without shelter a visitor waits under an umbrella and continues when the rain stops", () => {
  const items = town().filter((item) => item.type !== "pavilion"), sim = start(items);
  advance(sim, 7); sim.sync(items, { ...sunshine, weather: "rain" });
  assert.equal(sim.active.phase, "waiting");
  const position = [sim.active.x, sim.active.y]; advance(sim, 10);
  assert.deepEqual([sim.active.x, sim.active.y], position);
  sim.sync(items, sunshine); advance(sim, 100);
  assert.equal(sim.count, 1);
});

test("deleting the current road stops movement across the gap; reconnecting resumes from the same position", () => {
  const items = town(), sim = start(items); advance(sim, 7.6);
  const road = sim.active.route[sim.active.step];
  assert.ok(road.roadId);
  const broken = items.filter((item) => item.id !== road.roadId);
  const before = [sim.active.x, sim.active.y]; sim.sync(broken, sunshine); advance(sim, 40);
  assert.equal(sim.count, 0); assert.equal(sim.active.phase, "waiting");
  assert.ok(sim.active.x <= road.x, "cannot cross the deleted road");
  const waitingAt = [sim.active.x, sim.active.y]; advance(sim, 5); assert.deepEqual([sim.active.x, sim.active.y], waitingAt);
  sim.sync(items, sunshine); assert.deepEqual([sim.active.x, sim.active.y], waitingAt);
  advance(sim, 100); assert.equal(sim.count, 1); assert.ok(before.every(Number.isFinite));
});

test("a reachable alternate street is replanned without teleporting after removal", () => {
  const items = town();
  items.push(...[-144, -96, -48, 0, 48].map((x, i) => ({ id: 50 + i, type: "road", x, y: -36 })));
  const sim = start(items); advance(sim, 7);
  const position = [sim.active.x, sim.active.y];
  sim.sync(items.filter((item) => !(item.type === "road" && item.x === -48 && item.y === 12)), sunshine);
  assert.deepEqual([sim.active.x, sim.active.y], position);
  advance(sim, 100); assert.equal(sim.count, 1);
  assert.equal(sim.drainEvents().find((event) => event.kind === "postcard").visited.photo, true);
});

test("moving a garden cancels unfinished admiration; deleting shade cancels unfinished rest", () => {
  const items = town(), sim = start(items);
  until(sim, (a) => a?.phase === "admiring"); advance(sim, 1);
  const moved = items.map((item) => item.type === "garden" ? { ...item, x: 350, y: 180 } : item);
  sim.sync(moved, sunshine); assert.equal(sim.active.visited.garden, false);
  until(sim, (a) => a?.phase === "resting");
  sim.sync(moved.filter((item) => item.type !== "tree"), sunshine);
  advance(sim, 100);
  assert.deepEqual(sim.drainEvents().find((event) => event.kind === "postcard").visited, { garden: false, photo: false, rest: false });
});

test("a removed dock can be replaced; a broken return road never completes a trip", () => {
  const items = town(), sim = start(items);
  until(sim, (a) => a?.phase === "returning");
  const withoutDock = items.filter((item) => item.type !== "dock");
  sim.sync(withoutDock, sunshine); advance(sim, 10);
  assert.equal(sim.active.phase, "waiting"); assert.equal(sim.count, 0);
  sim.sync([...withoutDock, { id: 99, type: "dock", x: -240, y: 12 }], sunshine);
  advance(sim, 80); assert.equal(sim.count, 1);
});

test("refresh restores an interrupted walk and shelter; departure does not duplicate its postcard", () => {
  const items = town(); let sim = start(items); advance(sim, 9);
  const saved = sim.save(), position = [sim.active.x, sim.active.y];
  sim = Visitors.createSimulation(saved); sim.sync(items, sunshine);
  assert.deepEqual([sim.active.x, sim.active.y], position);
  sim.sync(items, { ...sunshine, weather: "rain" }); until(sim, (a) => a?.phase === "sheltered");
  sim = Visitors.createSimulation(sim.save()); sim.sync(items, { ...sunshine, weather: "rain" }); assert.equal(sim.active.phase, "sheltered");
  sim.sync(items, sunshine); until(sim, (a) => a?.phase === "leaving");
  assert.equal(sim.drainEvents().filter((e) => e.kind === "postcard").length, 1);
  sim = Visitors.createSimulation(sim.save()); sim.sync(items, sunshine); advance(sim, 8);
  assert.equal(sim.count, 1); assert.equal(sim.drainEvents().filter((e) => e.kind === "postcard").length, 0);
});

test("a bench reserved for a resident is skipped; a visitor reservation delays a resident's outing", () => {
  const sim = start(town(), { ...sunshine, occupied: [31] }); advance(sim, 100);
  assert.equal(sim.drainEvents().find((e) => e.kind === "postcard").visited.rest, false);
  const items = [...town(), { id: 70, type: "house", x: -144, y: -36 }];
  const life = Life.createSimulation(); life.sync(items); life.acceptWish("shade:70"); life.setReservedFacilities([31]);
  advance(life, 30); assert.equal(life.residents[0].phase, "home");
  life.setReservedFacilities([]); advance(life, 10); assert.notEqual(life.residents[0].phase, "home");
});

test("cancelled and failed arrivals do not send postcards; malformed visitor saves are ignored", () => {
  const sim = start(); sim.sync(town().filter((item) => item.type !== "dock"), sunshine);
  assert.equal(sim.active, null); assert.equal(sim.count, 0);
  assert.equal(sim.drainEvents().filter((e) => e.kind === "postcard").length, 0);
  sim.sync(town(), sunshine); sim.invite(); advance(sim, 8); assert.equal(sim.cancel(), true); advance(sim, 100); assert.equal(sim.count, 0);
  for (const value of [null, {}, { active: {} }, { active: { phase: "walking", x: Infinity, y: 0 } }]) assert.equal(Visitors.createSimulation(value).active, null);
});
