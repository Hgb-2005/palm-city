const { test } = require("node:test");
const assert = require("node:assert/strict");
const Identity = require("../city-identity.js");
const Collection = require("../city-collection.js");

const item = (id, type, x, y, rotate = 0) => ({ id, type, x, y, rotate });
const roads = (y = 12) => [-48, 0, 48, 96, 144].map((x, index) => item(index + 1, "road", x, y));
let nextId = 100;
const add = (type, x, y) => item(nextId++, type, x, y);

test("empty and detached layouts stay honest without inventing a district", () => {
  const empty = Identity.analyze([]);
  assert.equal(empty.title, "一页空白");
  assert.equal(empty.districts.length, 0);
  assert.equal(empty.traits.length, 2);

  const detached = Identity.analyze([
    add("garden", 288, 156),
    add("flower", -288, -132),
    add("water", 312, 132),
  ]);
  assert.equal(detached.title, "路外的风景");
  assert.equal(detached.districts.length, 0);
  assert.match(detached.residentLine, /小路/);
});

test("a connected residential layout becomes the city's strongest district", () => {
  const city = [
    ...roads(),
    add("house", -48, -36),
    add("house", 0, -36),
    add("house", 48, -36),
    add("house", 96, -36),
    add("shop", 144, -36),
  ];
  const identity = Identity.analyze(city, { season: "autumn" });
  assert.equal(identity.primary, "residential");
  assert.equal(identity.districts[0].label, "居住街区");
  assert.equal(identity.districts[0].strength, 5);
  assert.match(identity.summary, /秋日/);
  assert.ok(identity.traits.length >= 2 && identity.traits.length <= 4);
});

test("commercial, garden, waterside and leisure profiles each have a distinct identity", () => {
  const base = roads();
  const commercial = Identity.analyze([...base,
    add("shop", -48, -36), add("shop", 0, -36), add("shop", 48, -36)]);
  const green = Identity.analyze([...base,
    add("garden", -48, 60), add("garden", 0, 60), add("flower", 48, 60), add("tree", 96, 72),
    add("house", 96, -36)]);
  const waterside = Identity.analyze([...base,
    add("dock", -96, 12), add("water", -144, 12), add("water", -192, 12),
    add("house", 96, -36)]);
  const leisure = Identity.analyze([...base,
    add("bench", -48, -36), add("plaza", 0, -36), add("pavilion", 48, 60), add("lamp", 96, 72),
    add("house", 144, -36)]);
  assert.equal(commercial.primary, "commercial");
  assert.equal(green.primary, "green");
  assert.equal(waterside.primary, "waterside");
  assert.equal(leisure.primary, "leisure");
  assert.ok(["烟火小集", "晨光街市", "转角小店", "热闹檐廊"].includes(commercial.title));
  assert.ok(["青苔花园", "树影长街", "花木小巷", "风过绿廊"].includes(green.title));
  assert.ok(["枕水慢城", "河湾微光", "潮声小筑", "水色街角"].includes(waterside.title));
  assert.ok(["有闲小城", "晴光街角", "慢坐公园", "散步之城"].includes(leisure.title));
});

test("blended priorities produce a balanced identity and always keep two to four traits", () => {
  const city = [...roads(),
    add("house", -48, -36), add("house", 0, -36), add("house", 48, -36),
    add("shop", 96, -36), add("shop", 144, -36),
    add("garden", -48, 60), add("garden", 0, 60), add("bench", 48, -36),
    add("water", 144, 108)];
  const identity = Identity.analyze(city);
  assert.ok(identity.districts.length >= 3);
  assert.ok(identity.traits.length >= 2 && identity.traits.length <= 4);
  assert.match(identity.summary, /同样鲜明|主路网之外|最先/);
  assert.match(identity.signature, /^PC17-[0-9A-Z]{7}$/);
});

test("identity is deterministic across item order and does not mutate inputs", () => {
  const city = [...roads(),
    add("house", -48, -36), add("shop", 48, -36), add("garden", 96, 60), add("tree", 0, 72)];
  const original = JSON.stringify(city);
  const first = Identity.analyze(city, { season: "winter", weather: "rain" });
  const second = Identity.analyze([...city].reverse(), { season: "winter", weather: "rain" });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(city), original);
  assert.match(first.residentLine, /雨|冬/);
});

test("detached decoration cannot overstate a connected district", () => {
  const connected = [...roads(),
    add("house", 0, -36), add("shop", 48, -36)];
  const withDetachedGarden = [...connected,
    add("garden", 288, 156), add("flower", -288, -132), add("water", 312, 132)];
  const plain = Identity.analyze(connected);
  const scenic = Identity.analyze(withDetachedGarden);
  const plainGreen = plain.districts.find((district) => district.id === "green");
  const scenicGreen = scenic.districts.find((district) => district.id === "green");
  assert.equal(plainGreen, undefined);
  assert.equal(scenicGreen, undefined);
  assert.equal(plain.districts[0].strength, scenic.districts[0].strength);
  assert.ok(scenic.unservedCount > plain.unservedCount);
  assert.ok(scenic.traits.includes("小路外还留着风景"));
});

test("changing the actual layout changes the generated identity", () => {
  const residential = Identity.analyze([...roads(),
    add("house", -48, -36), add("house", 0, -36), add("house", 48, -36)]);
  const commercial = Identity.analyze([...roads(),
    add("house", -48, -36), add("shop", 0, -36), add("shop", 48, -36),
    add("shop", 96, -36), add("shop", 144, -36)]);
  assert.notEqual(residential.primary, commercial.primary);
  assert.notEqual(residential.title, commercial.title);
  assert.notEqual(residential.signature, commercial.signature);
});

test("city identity is derived at runtime and adds no saved fields or schema changes", () => {
  const data = Collection.buildTemplate("forest");
  const before = JSON.stringify(data);
  const identity = Identity.analyze(data.items, { season: data.season });
  assert.ok(identity.title);
  assert.equal(JSON.stringify(data), before);
  assert.equal(data.schema, 7);
  for (const key of ["title", "traits", "districts", "residentLine", "signature", "seal"]) {
    assert.equal(Object.hasOwn(data, key), false);
  }
});
