const {test} = require('node:test');
const assert = require('node:assert/strict');
const Life = require('../city-life.js');
const Collection = require('../city-collection.js');

test('real road encounters build friendships once per cooldown and survive a backup', () => {
  const city = Collection.buildTemplate('forest');
  const life = Life.createSimulation(); life.sync(city.items);
  for (let i=0;i<2400 && !life.progress().bonds.length;i++) life.tick(.1);
  assert.ok(life.progress().bonds.length);
  const bond = life.progress().bonds[0];
  const person = life.residents.find(r => r.homeId === bond.a);
  assert.equal(life.relationships(person)[0].level, '初次相识');
  const initial = life.progress().bonds.reduce((sum,b) => sum+b.count,0);
  for (let i=0;i<15;i++) life.tick(.1);
  assert.equal(life.progress().bonds.reduce((sum,b)=>sum+b.count,0), initial);
  for (let i=0;i<24000;i++) life.tick(.1);
  const events = life.drainEvents().filter(e => e.kind === 'friendship');
  assert.ok(events.length >= 2);
  assert.equal(new Set(events.map(e => e.id)).size, events.length);
  assert.ok(life.progress().bonds.some(b => b.count >= 8));
  city.progress = life.progress();
  const restored = Collection.parseImport(JSON.stringify(city)).data;
  const next = Life.createSimulation(restored.progress); next.sync(restored.items);
  assert.deepEqual(next.progress().bonds, city.progress.bonds);
  const detached = next.progress(); detached.bonds[0].count=1;
  assert.notEqual(next.progress().bonds[0].count, 1);
});

test('rain and disconnected homes never invent encounters; corrupt bonds are rejected', () => {
  const city = Collection.buildTemplate('forest');
  const life = Life.createSimulation(); life.sync(city.items.filter(i => i.type !== 'road'));
  for(let i=0;i<1000;i++) life.tick(.1);
  assert.deepEqual(life.progress().bonds, []);
  const rainy = Life.createSimulation(); rainy.sync(city.items); rainy.setWeather('rain');
  for(let i=0;i<1000;i++) rainy.tick(.1);
  assert.deepEqual(rainy.progress().bonds, []);
  assert.deepEqual(Life.cleanProgress({}).bonds, []);
  city.progress={bonds:[{a:1,b:2,count:-1}]};
  assert.throws(() => Collection.parseImport(JSON.stringify(city)), /邻里关系/);
});
