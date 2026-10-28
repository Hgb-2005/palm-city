(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityStories = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const chapters = {
    spring: { title: "等一朵花开", symbol: "❀", label: "春日", slot: 1, quote: "想沿着小路，看看亲手照料的花开了没有。", thanks: "原来等一朵花开，也这么幸福。", arrival: "花开了，想多看一会儿。", action: "在花园边看花", materials: ["garden", "road"] },
    summer: { title: "留一片树荫", symbol: "☀", label: "夏日", slot: 0, quote: "午后的风有点热，想找张树下的长椅歇歇。", thanks: "你留下的树荫，刚好装得下一个夏天。", arrival: "这里的风，是凉的。", action: "在树荫下乘凉", materials: ["tree", "bench", "road"] },
    autumn: { title: "和落叶坐一会儿", symbol: "❧", label: "秋日", slot: 2, quote: "想坐在树旁，听金黄的叶子落下来。", thanks: "这片小小的秋天，我会记得。", arrival: "你看，叶子慢慢落下来了。", action: "坐在树旁赏秋", materials: ["tree", "bench", "road"] },
    winter: { title: "冬夜的一点暖", symbol: "❄", label: "冬日", slot: 4, quote: "想在冬夜亮着灯的长椅旁，捧杯热茶坐一会儿。", thanks: "有这一盏灯，冬天也暖暖的。", arrival: "灯亮着，茶也还是热的。", action: "在冬夜灯下喝茶", materials: ["bench", "lamp", "road"] },
  };
  const valid = season => Object.hasOwn(chapters, season);
  function cleanProgress(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).filter(entry => {
      if (!entry || !valid(entry.season) || !Number.isSafeInteger(entry.homeId) || seen.has(entry.season)) return false;
      seen.add(entry.season); return true;
    }).slice(0, 4).map(entry => ({ season: entry.season, homeId: entry.homeId, completed: entry.completed === true }));
  }
  function validateProgress(value) {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > 4 || cleanProgress(value).length !== value.length || value.some(entry => typeof entry.completed !== "boolean")) {
      throw new Error("居民故事记录无效，请选择完整的小城备份。");
    }
  }
  function prepare(season, items, gardens = [], night = false) {
    season = valid(season) ? season : "spring";
    const chapter = chapters[season];
    const near = (item, type, radius) => items.some(other => other.type === type && Math.hypot(item.x - other.x, item.y - other.y) <= radius);
    let targets, conditions;
    if (season === "spring") {
      const blooms = new Set(gardens.filter(garden => garden.planted && garden.growth >= 1).map(garden => garden.id));
      targets = items.filter(item => item.type === "garden" && blooms.has(item.id));
      conditions = [{ label: "一块小花园", done: items.some(item => item.type === "garden") }, { label: "播种、浇水，等花园开花", done: targets.length > 0 }];
    } else {
      targets = items.filter(item => item.type === "bench" && near(item, season === "winter" ? "lamp" : "tree", season === "winter" ? 100 : 105));
      conditions = [{ label: season === "winter" ? "长椅旁有路灯（约两格内）" : "长椅旁有树木（约两格内）", done: targets.length > 0 }];
      if (season === "winter") conditions.push({ label: "等夜晚，也可手动切换", done: night });
    }
    return { ...chapter, season, targets, conditions };
  }
  return { chapters, valid, cleanProgress, validateProgress, prepare };
});
