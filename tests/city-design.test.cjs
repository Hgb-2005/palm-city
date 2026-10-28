const { test } = require("node:test");
const assert = require("node:assert/strict");
const Design = require("../city-design.js");
const Life = require("../city-life.js");
const Collection = require("../city-collection.js");
const road = (id, x, y = 12) => ({ id, type: "road", x, y });

test("roads distinguish isolated tiles, bends, T junctions and crossroads without diagonal links", () => {
  const center = road(1, 0);
  const neighbors = [road(2, 0, -36), road(3, 48), road(4, 0, 60), road(5, -48), road(6, 48, 60)];
  assert.deepEqual(Design.roadDirections(center, [center, neighbors[4]]), []);
  assert.deepEqual(Design.roadDirections(center, [center, ...neighbors]), ["n", "e", "s", "w"]);
  assert.match(Design.roadPath(["n", "e"]), /Q/);
  assert.doesNotMatch(Design.roadPath(["n", "s"]), /Q/);
  assert.equal((Design.roadPath(["n", "e", "w"]).match(/M/g) || []).length, 3);
});

test("connecting a remote home creates a cardinal route that residents can actually use", () => {
  const home = { id: 1, type: "house", x: 192, y: -180 };
  const shop = { id: 2, type: "shop", x: 0, y: -36 };
  const items = [home, shop, road(3, 0), road(4, 48), road(5, 96)];
  const original = JSON.stringify(items), plan = Design.planConnection(home, items);
  assert.equal(plan.status, "ready"); assert.ok(plan.additions.length > 0);
  assert.equal(JSON.stringify(items), original);
  const connected = [...items, ...plan.additions.map((p, i) => road(100 + i, p.x, p.y))];
  assert.ok(Life.findRoute(home, [shop], Life.createNetwork(connected)));
  assert.equal(Design.planConnection(home, connected).status, "connected");
  const simulation = Life.createSimulation(); simulation.sync(connected);
  for (let i = 0; i < 1500; i++) simulation.tick(.1);
  assert.ok(simulation.residents[0].trips > 0);
});

test("automatic roads go around water and buildings and stay on the island", () => {
  const home = { id: 1, type: "house", x: 192, y: -180 };
  const blockers = [{ id: 7, type: "water", x: 144, y: -84 }, { id: 8, type: "house", x: 96, y: -132 }];
  const plan = Design.planConnection(home, [home, ...blockers, road(3, 0), road(4, 48)]);
  assert.equal(plan.status, "ready");
  for (const point of plan.additions) {
    assert.ok(point.x >= -384 && point.x <= 384 && point.y >= -228 && point.y <= 204);
    assert.ok(!(Math.abs(point.x - 144) < 58 && Math.abs(point.y + 84) < 36));
    assert.ok(!(Math.abs(point.x - 96) < 35 && Math.abs(point.y + 132) < 32));
  }
});

test("a disconnected doorway spur reconnects to the main street rather than reporting success", () => {
  const home = { id: 1, type: "house", x: 192, y: -84 };
  const items = [home, road(2, 192, -36), road(3, -48), road(4, 0), road(5, 48)];
  const plan = Design.planConnection(home, items);
  assert.equal(plan.status, "ready"); assert.ok(plan.additions.length > 0);
  assert.ok(!plan.additions.some((p) => items.some((r) => r.type === "road" && r.x === p.x && r.y === p.y)));
});

test("new road segments avoid a tree trunk between otherwise empty grid cells", () => {
  const home = { id: 1, type: "house", x: 144, y: -84 };
  const tree = { id: 2, type: "tree", x: 72, y: -36 };
  const plan = Design.planConnection(home, [home, tree, road(3, -48), road(4, 0)]);
  assert.equal(plan.status, "ready");
  for (let i = 1; i < plan.path.length; i++) {
    const a = plan.path[i - 1], b = plan.path[i];
    const crosses = a.y === b.y && Math.abs(a.y - tree.y) < 17 && Math.min(a.x, b.x) < tree.x + 17 && Math.max(a.x, b.x) > tree.x - 17;
    assert.equal(crosses, false);
  }
});

test("off-grid imported roads cannot falsely report a usable grid connection", () => {
  const home = { id: 1, type: "house", x: 0, y: -36 };
  assert.equal(Design.planConnection(home, [home, road(2, 15, 12)]).status, "blocked");
});

test("missing streets and blocked entrances produce clear non-mutating results", () => {
  const home = { id: 1, type: "house", x: 0, y: -84 };
  assert.equal(Design.planConnection(home, [home]).status, "no-roads");
  assert.equal(Design.planConnection({ type: "tree" }, []).status, "unsupported");
  const water = [-48, 0, 48].flatMap((x, i) => [-132, -84, -36].map((y, j) => ({ id: 10 + i * 3 + j, type: "water", x, y })));
  assert.equal(Design.planConnection(home, [home, road(2, 288), ...water]).status, "blocked");
});

test("house details respond to water, gardens, neighbors and trees, then revert after removal", () => {
  const home = { id: 1, type: "house", x: 0, y: 0 };
  for (const [kind, other] of [
    ["waterfront", { id: 2, type: "water", x: 96, y: 48 }],
    ["garden", { id: 3, type: "garden", x: 72, y: 48 }],
    ["row", { id: 4, type: "house", x: 96, y: 0 }],
    ["forest", { id: 5, type: "tree", x: -72, y: 24 }],
  ]) assert.equal(Design.houseStyle(home, [home, other]).kind, kind);
  assert.equal(Design.houseStyle(home, [home]).kind, "cottage");
  assert.equal(Design.houseStyle(home, [home, { id: 6, type: "water", x: 300, y: 0 }]).kind, "cottage");
});

test("changing house surroundings never changes identity, items or saved city contents", () => {
  const data = Collection.buildTemplate("forest"), before = JSON.stringify(data);
  for (const item of data.items) if (item.type === "house") Design.houseStyle(item, data.items);
  assert.equal(JSON.stringify(data), before);
  const copy = Collection.parseImport(JSON.stringify(Collection.exportFile(Collection.makeRecord(data))));
  assert.deepEqual(copy.data.items, data.items);
});

test("small corner details respond to nearby scenery and revert after it moves away", () => {
  const bench = { id: 1, type: "bench", x: 0, y: 0 };
  const water = { id: 2, type: "water", x: 96, y: 0 };
  const tree = { id: 3, type: "tree", x: -72, y: 0 };
  const lamp = { id: 4, type: "lamp", x: 48, y: 0 };
  const items = [bench, water, tree, lamp], original = JSON.stringify(items);
  assert.equal(Design.cornerStyle(bench, items).kind, "shade");
  assert.equal(Design.cornerStyle(bench, [bench, water, lamp]).kind, "waterside");
  assert.equal(Design.cornerStyle(bench, [bench, lamp]).kind, "lamplit");
  assert.equal(Design.cornerStyle(bench, [bench, { ...tree, x: -180 }]), null);
  assert.equal(JSON.stringify(items), original);
});

test("shop flowers follow actual garden proximity without adding saved objects", () => {
  const shop = { id: 1, type: "shop", x: 0, y: 0 }, flowers = { id: 2, type: "flower", x: 96, y: 0 };
  assert.equal(Design.cornerStyle(shop, [shop, flowers]).kind, "florist");
  assert.equal(Design.cornerStyle(shop, [shop, { ...flowers, type: "garden" }]).kind, "florist");
  assert.equal(Design.cornerStyle(shop, [shop, { ...flowers, x: 120 }]), null);
  assert.equal(Design.cornerStyle(null, []), null);
});

test("neighbors greet during real journeys, pause briefly, then finish their trips", () => {
  const simulation = Life.createSimulation(); simulation.sync(Collection.buildTemplate("forest").items);
  let greeting = null;
  for (let i = 0; i < 1200 && !greeting; i++) {
    simulation.tick(.1);
    const resident = simulation.residents.find((r) => simulation.moment(r) === "greeting");
    if (resident) greeting = { resident, x: resident.x, y: resident.y, plan: resident.plan };
  }
  assert.ok(greeting); assert.match(simulation.speech(greeting.resident), /你好呀/);
  simulation.tick(.1);
  assert.equal(greeting.resident.x, greeting.x); assert.equal(greeting.resident.y, greeting.y);
  assert.equal(greeting.resident.plan, greeting.plan);
  const trips = greeting.resident.trips;
  for (let i = 0; i < 1200; i++) simulation.tick(.1);
  assert.ok(greeting.resident.trips > trips);
});

test("rain interrupts a greeting immediately and resumes the existing shelter behavior", () => {
  const simulation = Life.createSimulation(); simulation.sync(Collection.buildTemplate("forest").items);
  let resident;
  for (let i = 0; i < 1200; i++) { simulation.tick(.1); resident = simulation.residents.find((r) => simulation.moment(r) === "greeting"); if (resident) break; }
  assert.ok(resident); simulation.setWeather("rain");
  assert.notEqual(simulation.moment(resident), "greeting");
  assert.ok(["rain-walk", "rain-home", "home"].includes(resident.phase));
  for (let i = 0; i < 1000; i++) simulation.tick(.1);
  assert.ok(["sheltered", "home"].includes(resident.phase));
});

test("reading, drinking tea and carrying purchases correspond to actual completed arrivals", () => {
  const simulation = Life.createSimulation(); simulation.sync(Collection.buildTemplate("forest").items);
  const seen = new Set();
  for (let i = 0; i < 2400; i++) {
    simulation.tick(.1);
    for (const resident of simulation.residents) {
      const moment = simulation.moment(resident); seen.add(moment);
      if (["reading", "tea"].includes(moment)) assert.equal(resident.phase, "resting");
      if (moment === "carrying") assert.equal(resident.phase, "returning");
    }
  }
  assert.ok(["reading", "tea", "carrying", "shopping"].every((kind) => seen.has(kind)));
});
