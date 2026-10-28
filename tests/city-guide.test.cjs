const test = require('node:test');
const assert = require('node:assert/strict');
const Guide = require('../city-guide.js');
const Life = require('../city-life.js');
const Collection = require('../city-collection.js');
const Design = require('../city-design.js');
const item = (id,type,x=0,y=0) => ({id,type,x,y,rotate:0});
function context(items, options = {}) {
  const simulation = Life.createSimulation(options.progress);
  const gardens = options.gardens || [];
  simulation.sync(items); simulation.setStoryContext({season: options.season || 'spring',gardens});
  simulation.setNight(!!options.night); simulation.setWeather(options.rain ? 'rain' : 'sunny');
  if(options.accepted) simulation.acceptStory();
  return {simulation, input: () => ({items,gardens,chapter:simulation.story(),progress:simulation.progress().stories,paused:!!options.paused,rain:!!options.rain,night:!!options.night})};
}
const forest = () => Collection.buildTemplate('forest').items;

test('an empty island starts with a home, then a shop and real streets, without placing anything', () => {
  const items=[]; assert.deepEqual(Guide.suggest({items}).action,{kind:'material',type:'house'});
  items.push(item(1,'house',0,-84)); assert.equal(Guide.suggest({items}).action.type,'shop');
  items.push(item(2,'shop',0,60)); const before=JSON.stringify(items);
  const suggestion=Guide.suggest(context(items).input()); assert.equal(suggestion.action.type,'road');
  assert.equal(suggestion.milestones[1].done,false); assert.equal(JSON.stringify(items),before);
});
test('a broken route previews the right building before offering to build the planned segments', () => {
  const items=[item(1,'house',0,-84),item(2,'shop',0,60),item(3,'road',0,12)];
  const input=context(items).input(), preview=Guide.suggest(input); assert.deepEqual(preview.action,{kind:'focus',itemId:1});
  const selected=Guide.suggest({...input,selectedId:1}); assert.equal(selected.action.kind,'connect'); assert.match(selected.button,/1 段/);
  const plan=Design.planConnection(items[0],items); items.push(...plan.additions.map((p,i)=>({...item(10+i,'road'),...p})));
  assert.equal(Guide.suggest(context(items).input()).id,'accept');
});
test('an isolated doorstep is not treated as a connected shopping street', () => {
  const items=[item(1,'house',192,-84),item(2,'shop',0,60),item(3,'road',192,-36),...[-48,0,48].map((x,i)=>item(10+i,'road',x,12))];
  const suggestion=Guide.suggest(context(items).input()); assert.equal(suggestion.id,'connect'); assert.equal(suggestion.milestones[1].done,false);
});
test('blocked entrances produce a focus action rather than claiming a route or moving objects', () => {
  const items=[item(1,'house',0,-84),item(2,'shop',288,60),item(3,'road',288,12)];
  for(const x of [-48,0,48]) for(const y of [-132,-84,-36]) items.push(item(items.length+1,'water',x,y));
  const before=JSON.stringify(items), suggestion=Guide.suggest(context(items).input());
  assert.equal(suggestion.id,'blocked'); assert.equal(suggestion.action.itemId,1); assert.equal(JSON.stringify(items),before);
});
test('an existing town invites explicit acceptance without fabricating story progress', () => {
  const c=context(forest()), before=c.simulation.progress(); const suggestion=Guide.suggest(c.input());
  assert.equal(suggestion.id,'accept'); assert.deepEqual(suggestion.action,{kind:'accept'});
  assert.deepEqual(c.simulation.progress(),before); assert.equal(suggestion.milestones[2].done,false);
});
test('accepted spring stories suggest a real garden, sowing and water in order', () => {
  const items=forest().filter(i=>i.type!=='garden');
  assert.equal(Guide.suggest(context(items,{accepted:true}).input()).action.type,'garden');
  const plot=item(900,'garden',144,60); items.push(plot);
  assert.deepEqual(Guide.suggest(context(items,{accepted:true}).input()).action,{kind:'sow',itemId:900});
  const gardens=[{id:900,planted:true,growth:.4,moisture:0}];
  assert.equal(Guide.suggest(context(items,{accepted:true,gardens}).input()).id,'water');
  gardens[0].moisture=.1; assert.equal(Guide.suggest(context(items,{accepted:true,gardens}).input()).id,'water');
});
test('a watered garden waits honestly for time and sun without completing the story', () => {
  const items=forest(), plot=items.find(i=>i.type==='garden'), gardens=[{id:plot.id,planted:true,growth:.64,moisture:.7}];
  assert.equal(Guide.suggest(context(items,{accepted:true,gardens,paused:true}).input()).id,'resume');
  assert.equal(Guide.suggest(context(items,{accepted:true,gardens,rain:true}).input()).id,'sunny');
  const c=context(items,{accepted:true,gardens}), suggestion=Guide.suggest(c.input());
  assert.equal(suggestion.id,'growing'); assert.match(suggestion.title,/64%/); assert.equal(c.simulation.progress().stories[0].completed,false);
});
test('blooming gardens require a complete route and removed garden records cannot satisfy it', () => {
  const items=forest().filter(i=>i.type!=='garden'); items.push(item(900,'garden',336,156));
  const c=context(items,{accepted:true,gardens:[{id:900,planted:true,growth:1,moisture:.8}]});
  assert.equal(Guide.suggest(c.input()).id,'connect');
  items.pop(); assert.equal(Guide.suggest(context(items,{accepted:true,gardens:[{id:900,planted:true,growth:1}]}).input()).action.type,'garden');
});
test('summer and autumn request a nearby tree rather than any tree elsewhere on the island', () => {
  for(const season of ['summer','autumn']) {
    const items=forest().filter(i=>!['bench','tree'].includes(i.type)); items.push(item(900,'tree',360,-240));
    assert.equal(Guide.suggest(context(items,{season,accepted:true}).input()).action.type,'bench');
    items.push(item(901,'bench',-240,60)); assert.equal(Guide.suggest(context(items,{season,accepted:true}).input()).action.type,'tree');
    items.push(item(902,'tree',-312,84)); assert.equal(Guide.suggest(context(items,{season,accepted:true}).input()).id,'waiting');
  }
});
test('winter guidance checks nearby light, actual route, night, rain and paused time separately', () => {
  const items=forest().filter(i=>i.type!=='lamp');
  assert.equal(Guide.suggest(context(items,{season:'winter',accepted:true}).input()).action.type,'lamp');
  items.push(item(900,'lamp',-240,12));
  assert.equal(Guide.suggest(context(items,{season:'winter',accepted:true}).input()).id,'night');
  assert.equal(Guide.suggest(context(items,{season:'winter',accepted:true,night:true,rain:true}).input()).id,'sunny');
  assert.equal(Guide.suggest(context(items,{season:'winter',accepted:true,night:true,paused:true}).input()).id,'resume');
  assert.equal(Guide.suggest(context(items,{season:'winter',accepted:true,night:true}).input()).id,'waiting');
});
test('following is suggested during an actual visit and completion appears only after real arrival and stay', () => {
  const c=context(forest(),{season:'summer',accepted:true}); let visiting=false, completed=false;
  for(let i=0;i<1800;i++) {
    c.simulation.tick(.1); const suggestion=Guide.suggest(c.input());
    if(suggestion.id==='visiting') { visiting=true; assert.equal(suggestion.action.kind,'follow'); assert.equal(c.simulation.progress().stories[0].completed,false); }
    if(suggestion.id==='next-season') { completed=true; break; }
  }
  assert.equal(visiting,true); assert.equal(completed,true); assert.equal(c.simulation.progress().stories[0].completed,true);
});
test('a completed chapter suggests the next unfinished season and four completed chapters suggest a photo', () => {
  const items=forest(), home=items.find(i=>i.type==='house');
  const stories=[{season:'spring',homeId:home.id,completed:true}];
  assert.equal(Guide.suggest(context(items,{progress:{stories}}).input()).action.season,'summer');
  stories.push(...['summer','autumn','winter'].map(season=>({season,homeId:home.id,completed:true})));
  const c=context(items,{progress:{stories}}), before=c.simulation.progress();
  assert.equal(Guide.suggest(c.input()).action.kind,'photo'); assert.deepEqual(c.simulation.progress(),before);
});
test('guidance follows restored city contents and adds no new fields to old backups', () => {
  const original=Collection.buildTemplate('forest'), before=JSON.stringify(original);
  Guide.suggest(context(original.items).input()); assert.equal(JSON.stringify(original),before);
  const imported=Collection.parseImport(JSON.stringify(Collection.exportFile(Collection.makeRecord(original))));
  assert.equal(Guide.suggest(context(imported.data.items).input()).id,'accept'); assert.equal(imported.data.schema,7); assert.equal(imported.data.guide,undefined);
});
