(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./city-seasons.js") : root.PalmCitySeasons);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityRoaming = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Seasons) {
  "use strict";
  const MIN_ZOOM = .72, MAX_ZOOM = 3.6, PHOTO_LIMIT = 20, IMAGE_LIMIT = 260000;
  const presets = {
    overview: { label: "全景", zoom: 1 },
    street: { label: "街角", zoom: 1.85 },
    neighbor: { label: "邻居", zoom: 3.1 },
  };
  const isPreset = (value) => typeof value === "string" && Object.prototype.hasOwnProperty.call(presets, value);
  const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || 1));
  const clock = (minutes) => {
    const value = ((Number(minutes) || 0) % 1440 + 1440) % 1440;
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  };
  function frame(preset, focus = { x: 0, y: 0 }) {
    const zoom = isPreset(preset) ? presets[preset].zoom : 1;
    return { zoom, panX: -(Number(focus.x) || 0) * zoom, panY: -(Number(focus.y) || 0) * zoom };
  }
  function viewport(width, height, compact = false) {
    if (!compact || !(width > 0) || !(height > 0)) return { x: -620, y: -370, width: 1240, height: 740 };
    // Fit the complete island horizontally without storing a device-specific camera.
    const span = Math.max(960, 640 * width / height), tall = span * height / width;
    return { x: -span / 2, y: -tall / 2, width: span, height: tall };
  }
  function smooth(camera, target, dt, reducedMotion = false) {
    const weight = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, Math.min(Number(dt) || 0, .1)) * 6);
    return Object.fromEntries(["zoom", "panX", "panY"].map((key) => [key, camera[key] + (target[key] - camera[key]) * weight]));
  }
  function focusResident(resident) {
    if (!resident) return null;
    const point = resident.visible ? resident : resident.home;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { x: point.x, y: point.y - 18 };
  }
  function validPhoto(photo) {
    return photo && typeof photo.id === "string" && photo.id.length > 0 && photo.id.length <= 100
      && Number.isFinite(photo.createdAt) && photo.createdAt > 0
      && typeof photo.cityName === "string" && photo.cityName.length <= 18
      && typeof photo.note === "string" && photo.note.length <= 80
      && typeof photo.followedName === "string" && photo.followedName.length <= 18
      && typeof photo.clock === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(photo.clock)
      && ["sunny", "rain"].includes(photo.weather)
      && (photo.season === undefined || Seasons.isSeason(photo.season))
      && (isPreset(photo.preset) || photo.preset === "custom")
      && Number.isInteger(photo.width) && Number.isInteger(photo.height)
      && photo.width >= 64 && photo.width <= 1600 && photo.height >= 64 && photo.height <= 1600
      && typeof photo.image === "string" && photo.image.length <= IMAGE_LIMIT
      && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.image)
      && !photo.pendingScene;
  }
  function validatePhotos(photos) {
    if (!Array.isArray(photos) || photos.length > PHOTO_LIMIT) throw new Error("个人相册最多可保存 20 张照片，请检查备份文件。");
    const ids = new Set();
    for (const photo of photos) {
      if (!validPhoto(photo) || ids.has(photo.id)) throw new Error("个人相册中有损坏的照片、重复编号或无效留言，请选择完整备份。");
      ids.add(photo.id);
    }
    return photos;
  }
  function cleanPhotos(value) {
    const ids = new Set();
    return (Array.isArray(value) ? value : []).filter((photo) => {
      if (!validPhoto(photo) || ids.has(photo.id)) return false;
      ids.add(photo.id); return true;
    }).slice(0, PHOTO_LIMIT).map((photo) => ({
      id: photo.id, createdAt: photo.createdAt, cityName: photo.cityName, note: photo.note,
      followedName: photo.followedName, clock: photo.clock, weather: photo.weather, preset: photo.preset,
      image: photo.image, width: photo.width, height: photo.height,
      ...(Seasons.isSeason(photo.season) ? { season: photo.season } : {}),
    }));
  }
  function makePhoto(value) {
    const photo = {
      id: `photo-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      createdAt: value.createdAt || Date.now(), cityName: String(value.cityName || "").slice(0, 18),
      note: String(value.note || "").trim().slice(0, 80), followedName: String(value.followedName || "").slice(0, 18),
      clock: clock(value.minutes), weather: value.weather === "rain" ? "rain" : "sunny",
      preset: isPreset(value.preset) ? value.preset : "custom", image: value.image, width: value.width, height: value.height,
      ...(Seasons.isSeason(value.season) ? { season: value.season } : {}),
    };
    validatePhotos([photo]); return photo;
  }
  return { presets, MIN_ZOOM, MAX_ZOOM, PHOTO_LIMIT, IMAGE_LIMIT, clampZoom, frame, viewport, smooth, focusResident, clock, validatePhotos, cleanPhotos, makePhoto };
});
