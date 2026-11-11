const test = require("node:test");
const assert = require("node:assert/strict");
const Letters = require("../city-letters.js");

function city() {
  return {
    residents: [
      { id: "resident-1", name: "阿禾", homeId: 1, home: { id: 1, type: "house", x: 0, y: 0 } },
      { id: "resident-2", name: "小林", homeId: 2, home: { id: 2, type: "house", x: 192, y: 0 } },
    ],
    items: [
      { id: 1, type: "house", x: 0, y: 0 },
      { id: 2, type: "house", x: 192, y: 0 },
      { id: 3, type: "road", x: 0, y: 60 },
      { id: 4, type: "road", x: 48, y: 60 },
      { id: 5, type: "road", x: 96, y: 60 },
      { id: 6, type: "road", x: 144, y: 60 },
      { id: 7, type: "road", x: 192, y: 60 },
    ],
  };
}

function readyContext(targetType = "pavilion") {
  const context = city();
  context.targetType = targetType;
  return context;
}

function addLetterTarget(context, id = 20) {
  const slots = [96, 48, 0, 96, 48];
  context.items.push({ id, type: context.targetType, x: slots[Math.max(0, Number(id) - 20) % slots.length], y: 108 });
  return context.items.at(-1);
}

test("a letter is deterministic for the same game day", () => {
  const letters = Letters.createLetters();
  const first = letters.current(city());
  const second = letters.current(city());
  assert.equal(first.day, 1);
  assert.equal(first.kind, "shelter");
  assert.equal(second.id, first.id);
  assert.equal(letters.options(city()).length, 2);
});

test("no residents means no letter", () => {
  const letters = Letters.createLetters();
  assert.equal(letters.current({ residents: [], items: [] }), null);
});

test("accepting a response locks in a visible tradeoff", () => {
  const letters = Letters.createLetters();
  const context = city();
  letters.current(context);
  const accepted = letters.accept("rain-pavilion", context);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.active.status, "accepted");
  assert.match(accepted.option.tradeoff, /夜里/);
  assert.equal(letters.accept("rain-lamp", context).ok, false);
});

test("preparation needs the selected building and a real route", () => {
  const letters = Letters.createLetters();
  const context = city();
  letters.accept("rain-pavilion", context);
  assert.equal(letters.prepare(99, context).ok, false);
  context.items.push({ id: 20, type: "pavilion", x: 500, y: 500 });
  assert.equal(letters.prepare(20, context).ok, false);
  context.items.at(-1).x = 96;
  context.items.at(-1).y = 108;
  const prepared = letters.prepare(20, context);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.active.status, "prepared");
  assert.ok(prepared.route.points.length >= 2);
});

test("departure, completion and next day preserve the consequence", () => {
  const letters = Letters.createLetters();
  const context = readyContext();
  letters.accept("rain-pavilion", context);
  addLetterTarget(context);
  letters.prepare(20, context);
  assert.equal(letters.depart(context).ok, true);
  const completed = letters.complete({ createdAt: 1234 });
  assert.equal(completed.title, "一场雨，有了屋檐");
  assert.match(completed.effect, /公共角落/);
  assert.match(completed.tradeoff, /夜里/);
  assert.equal(letters.current(context).status, "completed");
  const next = letters.advance(context);
  assert.equal(next.ok, true);
  assert.equal(next.day, 2);
  const echo = letters.echo(context);
  assert.equal(echo.title, "一场雨，有了屋檐");
  assert.match(echo.echoText, /阿禾|小林/);
});

test("a broken route returns a prepared response to preparation", () => {
  const letters = Letters.createLetters();
  const context = readyContext("lamp");
  letters.accept("rain-lamp", context);
  addLetterTarget(context);
  letters.prepare(20, context);
  context.items = context.items.filter((item) => item.type !== "road");
  const result = letters.depart(context);
  assert.equal(result.ok, false);
  assert.equal(letters.current(context).status, "accepted");
  assert.equal(letters.current(context).targetId, null);
});

test("saved state restores an in-progress letter and history without sharing references", () => {
  const letters = Letters.createLetters();
  const context = readyContext();
  letters.accept("rain-pavilion", context);
  addLetterTarget(context);
  letters.prepare(20, context);
  const saved = letters.save();
  const restored = Letters.createLetters(saved);
  assert.equal(restored.current(context).status, "prepared");
  assert.equal(restored.day, 1);
  const copy = restored.current(context);
  copy.status = "offered";
  assert.equal(restored.current(context).status, "prepared");
});

test("malformed and old saves degrade to a valid first letter", () => {
  for (const value of [null, false, "bad", { day: -8, active: { status: "bad" }, history: [{}] }]) {
    const letters = Letters.createLetters(value);
    const current = letters.current(city());
    assert.equal(current.day, 1);
    assert.equal(current.status, "offered");
    assert.deepEqual(letters.history(), []);
  }
});

test("days rotate through five focused letter themes", () => {
  const letters = Letters.createLetters();
  const seen = [];
  for (let day = 1; day <= 5; day += 1) {
    const context = city();
    const active = letters.current(context);
    seen.push(active.kind);
    const option = letters.options(context)[0];
    letters.accept(option.id, context);
    context.targetType = option.targetType;
    const target = addLetterTarget(context, 20 + day);
    const prepared = letters.prepare(target.id, context);
    assert.equal(prepared.ok, true, `day ${day}: ${prepared.reason || target.type} at ${target.x},${target.y}`);
    letters.depart(context);
    letters.complete({ createdAt: day });
    letters.advance(context);
  }
  assert.deepEqual(seen, ["shelter", "meeting", "lamplight", "bloom", "memory"]);
});

test("accepting a letter records existing targets so only a new facility can complete it", () => {
  const letters = Letters.createLetters();
  const context = city();
  context.items.push({ id: 20, type: "pavilion", x: 96, y: 108 });
  letters.accept("rain-pavilion", context);
  const existing = letters.prepare(20, context);
  assert.equal(existing.ok, false);
  assert.match(existing.reason, /新设施/);
  context.items.push({ id: 21, type: "pavilion", x: 144, y: 108 });
  assert.equal(letters.prepare(21, context).ok, true);
});
