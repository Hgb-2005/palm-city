(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityWeather = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const durations = { sunny: 90, rain: 45 };
  const clamp = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  const stage = (garden) => !garden.planted ? "empty" : garden.growth >= 1 ? "bloom" : garden.growth >= .68 ? "bud" : garden.growth >= .28 ? "sprout" : "seed";

  function createEnvironment(saved = {}) {
    let weather;
    let gardens;
    let activeIds = new Set();
    let rainBloomRecorded;
    let events = [];

    function restore(value = {}) {
      if (!value || typeof value !== "object") value = {};
      const source = value.weather || {};
      weather = { kind: source.kind === "rain" ? "rain" : "sunny", elapsed: 0, auto: source.auto !== false };
      weather.elapsed = Number.isFinite(source.elapsed) ? Math.max(0, Math.min(durations[weather.kind] - .01, source.elapsed)) : 0;
      gardens = new Map();
      for (const entry of Array.isArray(value.gardens) ? value.gardens.slice(0, 500) : []) {
        if (!entry || !Number.isFinite(entry.id)) continue;
        gardens.set(entry.id, { id: entry.id, planted: entry.planted === true, growth: clamp(entry.growth), moisture: clamp(entry.moisture), rainFed: entry.rainFed === true, bloomed: entry.bloomed === true });
      }
      rainBloomRecorded = value.rainBloomRecorded === true;
      events = [];
    }

    function sync(items) {
      activeIds = new Set(items.filter((item) => item.type === "garden").map((item) => item.id));
      for (const id of activeIds) if (!gardens.has(id)) gardens.set(id, { id, planted: false, growth: 0, moisture: 0, rainFed: false, bloomed: false });
      // Keep recently removed plots so undo brings their living progress back.
      if (gardens.size > 500) for (const id of gardens.keys()) {
        if (!activeIds.has(id)) gardens.delete(id);
        if (gardens.size <= 500) break;
      }
    }

    function setWeather(kind) {
      if (!["sunny", "rain"].includes(kind) || kind === weather.kind) return false;
      weather.kind = kind;
      weather.elapsed = 0;
      return true;
    }

    function sow(id) {
      const garden = gardens.get(id);
      if (!activeIds.has(id) || !garden || garden.planted) return false;
      garden.planted = true;
      return true;
    }

    function water(id) {
      const garden = gardens.get(id);
      if (!activeIds.has(id) || !garden?.planted || garden.growth >= 1 || garden.moisture >= .95) return false;
      garden.moisture = 1;
      return true;
    }

    function tick(seconds) {
      const dt = Math.max(0, Math.min(Number(seconds) || 0, .25));
      let weatherChanged = false;
      let stageChanged = false;
      if (weather.auto) {
        weather.elapsed += dt;
        if (weather.elapsed >= durations[weather.kind]) weatherChanged = setWeather(weather.kind === "rain" ? "sunny" : "rain");
      }
      for (const id of activeIds) {
        const garden = gardens.get(id);
        if (!garden.planted || garden.growth >= 1) continue;
        const previous = stage(garden);
        if (weather.kind === "rain") {
          garden.moisture = Math.min(1, garden.moisture + dt * .14);
          if (dt > 0) garden.rainFed = true;
        }
        if (garden.moisture > .01) {
          garden.growth = Math.max(garden.growth, Math.min(weather.kind === "rain" ? .9 : 1, garden.growth + dt * .025));
          garden.moisture = Math.max(0, garden.moisture - dt * .003);
        }
        if (garden.growth >= 1 && !garden.bloomed) {
          garden.bloomed = true;
          if (garden.rainFed && !rainBloomRecorded) {
            rainBloomRecorded = true;
            events.push({ id: "first:rain-bloom", kind: "rain-bloom", title: "小城的第一次雨后开花", text: "一场小雨浇过花园。雨停后，第一朵花慢慢绽放了。", quote: "花开有自己的时候，谢谢你愿意等。" });
          } else if (!garden.rainFed) events.push({ id: `garden:bloom:${id}`, kind: "garden", title: "亲手照顾的第一朵花", text: "从一颗种子开始，浇一点水，等来了花园里的第一朵花。", quote: "你留下一点照料，日子还你一朵花。" });
        }
        if (stage(garden) !== previous) stageChanged = true;
      }
      return { weatherChanged, stageChanged };
    }

    restore(saved);
    return {
      sync, tick, setWeather, sow, water, restore,
      setAuto(value) { weather.auto = !!value; },
      get weather() { return { ...weather, duration: durations[weather.kind] }; },
      garden(id) { const value = gardens.get(id); return value ? { ...value, stage: stage(value) } : null; },
      save() { return { weather: { ...weather }, gardens: [...gardens.values()].map((entry) => ({ ...entry })), rainBloomRecorded }; },
      drainEvents() { const pending = events; events = []; return pending; },
    };
  }

  return { createEnvironment };
});
