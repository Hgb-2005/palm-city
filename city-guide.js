(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./city-life.js") : root.PalmCityLife, common ? require("./city-design.js") : root.PalmCityDesign, common ? require("./city-stories.js") : root.PalmCityStories);
  if (common) module.exports = api;
  else root.PalmCityGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Life, Design, Stories) {
  "use strict";

  function suggest({ items = [], gardens = [], chapter = {}, progress = [], paused = false, rain = false, night = false, selectedId = null, network = null } = {}) {
    const homes = items.filter(item => item.type === "house").slice(0, 5), shops = items.filter(item => item.type === "shop");
    network ||= Life.createNetwork(items);
    const connected = homes.some(home => Life.findRoute(home, shops, network));
    const milestones = [
      { label: "邻居入住", done: homes.length > 0 },
      { label: "街道相通", done: !!connected },
      { label: "留下一页回忆", done: progress.some(entry => entry.completed) },
    ];
    const card = (id, title, text, button, action) => ({ id, title, text, button, action, milestones });
    const material = (type, title, text) => card(`place-${type}`, title, text, `安放${{ house: "小屋", shop: "商店", road: "小路", garden: "小花园", bench: "长椅", tree: "树木", lamp: "路灯" }[type]}`, { kind: "material", type });
    function connect(home, targets) {
      if (!network.roads.length) return material("road", "先留下一段小路", "在家门旁约一格的地方铺路，再选中建筑看看接路规划。");
      const candidates = [home, ...targets].filter(Boolean).map(item => ({ item, plan: Design.planConnection(item, items) }));
      const ready = candidates.find(entry => entry.plan.status === "ready");
      if (ready) {
        const { item, plan } = ready, selected = selectedId === item.id;
        return card("connect", "把门前接到街道上", `规划还需 ${plan.additions.length} 段小路。接通后会重新检查整条路线，邻居才走得过去。`, selected ? `铺下 ${plan.additions.length} 段小路` : "看看接路位置", { kind: selected ? "connect" : "focus", itemId: item.id });
      }
      const blocked = candidates.find(entry => entry.plan.status === "blocked");
      if (blocked) return card("blocked", "给入口留一点空地", "入口附近被挡住了。先挪开一些素材，再按规划接路。", "看看被挡住的入口", { kind: "focus", itemId: blocked.item.id });
      return material("road", "让两端的小路真正相连", "目前还没有完整通路。小路按上下左右连接，斜着相邻还走不过去。");
    }

    if (!homes.length) return material("house", "给第一位邻居留一扇窗", "先安放一间小屋。有人住下来，这座小城就有了故事的主角。");
    if (!shops.length) return material("shop", "让街角多一个去处", "安放一间小商店，再把家与商店的小路连起来，邻居就有地方逛逛了。");
    const home = homes.find(item => item.id === chapter.homeId) || homes[0];
    if (!Life.findRoute(home, shops, network)) return connect(home, shops);

    const season = Stories.valid(chapter.season) ? chapter.season : "spring";
    if (chapter.status === "completed") {
      const order = Object.keys(Stories.chapters), index = order.indexOf(season);
      const next = [...order.slice(index + 1), ...order.slice(0, index)].find(value => !progress.some(entry => entry.season === value && entry.completed));
      if (next) return card("next-season", "这一季的谢谢，已经留下", `想再走走时，可以去听听${Stories.chapters[next].label}的「${Stories.chapters[next].title}」。`, `去听${Stories.chapters[next].label}的故事`, { kind: "season", season: next });
      return card("photo", "四季的日常，都有了回忆", "四页故事都已珍藏。换个喜欢的角度，给现在的小城留张照片吧。", "拍一张留念", { kind: "photo" });
    }
    if (chapter.status === "available") return card("accept", "听听邻居的小小期待", `${chapter.name || "邻居"}想和你一起完成「${chapter.title || Stories.chapters[season].title}」。先记下约定，再慢慢布置。`, "记下这个约定", { kind: "accept" });

    const prepared = Stories.prepare(season, items, gardens, night);
    if (season === "spring") {
      const plots = items.filter(item => item.type === "garden");
      if (!plots.length) return material("garden", "留一块等花开的土地", "小花园可以播种和浇水。选好地方，陪邻居等一朵花开。");
      if (!prepared.targets.length) {
        const plot = plots.find(item => gardens.some(garden => garden.id === item.id && garden.planted)) || plots[0];
        const garden = gardens.find(entry => entry.id === plot.id);
        if (!garden?.planted) return card("sow", "把第一粒种子交给土地", "花园还空着。播下种子后，浇一点水，等它慢慢长大。", "播下种子", { kind: "sow", itemId: plot.id });
        if (garden.moisture <= .1) return card("water", "给嫩芽一点水", "土壤有些干了。浇水后，种子就能继续生长；小雨也会照料它。", "浇一点水", { kind: "water", itemId: plot.id });
        if (paused) return card("resume", "让花园继续慢慢长大", "小城暂停中，花园也在歇息。继续时间，就能看它从嫩芽长到花开。", "继续小城时间", { kind: "resume" });
        if (rain) return card("sunny", "花园喝过雨，再等等晴天", "雨水正在照料花园。想看花苞绽放，可以等雨停，也可以看看晴天。", "看看晴天", { kind: "sunny" });
        return card("growing", `花园正在长大 · ${Math.min(100, Math.floor((garden.growth || 0) * 100))}%`, "水分够了，接下来交给时间。你可以先逛逛，小花园不会枯萎。", "看看这块花园", { kind: "focus", itemId: plot.id });
      }
    } else {
      const benches = items.filter(item => item.type === "bench");
      if (!benches.length) return material("bench", "给散步的人一个歇脚处", "先安放一张长椅，留一个可以坐下来听风的角落。");
      if (!benches.some(bench => items.some(item => item.type === (season === "winter" ? "lamp" : "tree") && Math.hypot(bench.x - item.x, bench.y - item.y) <= (season === "winter" ? 100 : 105)))) {
        return season === "winter" ? material("lamp", "在长椅旁留一点暖光", "把路灯放在长椅约两格以内，晚归时就有灯陪着。") : material("tree", "让长椅坐进树荫里", "把树木放在长椅约两格以内，邻居会来乘凉或看看落叶。");
      }
    }
    if (!Life.findRoute(home, prepared.targets, network)) return connect(home, prepared.targets);
    if (season === "winter" && !night) return card("night", "等街灯亮起，再喝一杯热茶", "长椅和路灯已经准备好。冬夜降临时，邻居会沿着小路来赴约。", "看看夜晚", { kind: "night" });
    if (rain) return card("sunny", "先听一会儿雨，约定还在", "邻居会先避雨，放晴后继续赴约。也可以现在看看晴天。", "看看晴天", { kind: "sunny" });
    if (paused) return card("resume", "布置好了，让日常继续", "道路和角落都已准备好。继续小城时间，邻居就能亲自走来看看。", "继续小城时间", { kind: "resume" });
    return card(chapter.status === "visiting" ? "visiting" : "waiting", chapter.status === "visiting" ? "邻居正赴约，陪他走一段" : "约定记下了，等邻居慢慢出门", "他会先完成手边的心愿，再沿真实小路到场停留；那时才会留下一页回忆。", "跟着邻居走走", { kind: "follow", residentId: chapter.residentId });
  }
  return { suggest };
});
