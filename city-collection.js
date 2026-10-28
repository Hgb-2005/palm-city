(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./city-roaming.js") : root.PalmCityRoaming, typeof module === "object" && module.exports ? require("./city-seasons.js") : root.PalmCitySeasons, typeof module === "object" && module.exports ? require("./city-stories.js") : root.PalmCityStories);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCityCollection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Roaming, Seasons, Stories) {
  "use strict";
  const TYPES = new Set(["house", "shop", "tree", "road", "flower", "water", "bench", "lamp", "plaza", "pavilion", "garden", "dock"]);
  const FORMAT = "palm-sized-city";
  const DB_NAME = "palm-city-collection-v7";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const templates = [
    { id: "forest", name: "林间村落", cityName: "松风林里", symbol: "♧", description: "让屋顶藏进树影，沿着小路听风。", colors: ["#dce5c7", "#789779"] },
    { id: "waterfront", name: "滨水小镇", cityName: "水岸慢城", symbol: "≈", description: "留一条通向码头的路，把日子交给水波。", colors: ["#d7e6df", "#80a99b"] },
    { id: "garden", name: "花园街区", cityName: "花开巷陌", symbol: "⚘", description: "几块待播种的土地，等你种下一整个春天。", colors: ["#ece3cf", "#bd9d86"] },
    { id: "empty", name: "一座空岛", cityName: "未命名的小岛", symbol: "＋", description: "一片空地，一个名字。故事从你开始。", colors: ["#e7e8d6", "#b0b68d"] },
  ];
  function buildTemplate(id) {
    const theme = templates.find((entry) => entry.id === id);
    if (!theme) throw new Error("请选择一种开局。");
    let items = [], itemId = 1;
    const add = (type, x, y) => items.push({ id: itemId++, type, x, y, rotate: 0 });
    const row = id === "waterfront" ? 60 : 12;
    if (id !== "empty") {
      for (let x = -336; x <= 240; x += 48) add("road", x, row);
      add("dock", -384, row);
    }
    if (id === "forest") {
      for (const x of [-144, -48, 48]) { add(x === 48 ? "shop" : "house", x, -84); add("road", x, -36); }
      for (const [x, y] of [[-288, -72], [-240, -132], [-216, 120], [-312, 84], [144, -120], [240, -84], [264, 96], [72, 144]]) add("tree", x, y);
      add("bench", -240, 60); add("garden", 144, 60); add("pavilion", -48, 60); add("lamp", -144, 60);
    } else if (id === "waterfront") {
      for (const x of [-144, -48, 144]) { add(x === 144 ? "shop" : "house", x, -36); add("road", x, 12); }
      for (const [x, y] of [[120, 144], [216, 144], [264, 96], [312, 48]]) add("water", x, y);
      add("garden", -144, 126); add("bench", 48, 108); add("tree", 108, 174); add("pavilion", -240, 108);
      add("plaza", -48, 108); add("lamp", 48, 12); add("tree", -288, -36); add("tree", 240, -108);
    } else if (id === "garden") {
      for (const x of [-96, 0, 144]) { add(x === 144 ? "shop" : "house", x, -84); add("road", x, -36); }
      for (const x of [-144, 48, 192]) add("garden", x, 60);
      add("bench", -240, 60); add("tree", -312, 84); add("tree", 288, 36); add("pavilion", -48, 60);
      add("flower", -216, -84); add("flower", 96, 144); add("lamp", -144, -36); add("lamp", 48, -36);
    }
    return { schema: 7, cityName: theme.cityName, season: "spring", items, zoom: 1, panX: 0, panY: 0, lastEdited: Date.now(), minutes: 540, paused: false,
      progress: { accepted: [], completed: [], identities: [] }, journal: [], postcards: [], photos: [], environment: {}, visitors: { count: 0, active: null }, sound: false };
  }

  function uniqueName(desired, names = []) {
    const base = String(desired || "未命名小城").trim().slice(0, 18) || "未命名小城";
    if (!names.includes(base)) return base;
    for (let number = 2; number < 10000; number++) {
      const suffix = ` · ${number}`;
      const candidate = base.slice(0, 18 - suffix.length) + suffix;
      if (!names.includes(candidate)) return candidate;
    }
    return base.slice(0, 8) + Date.now().toString().slice(-8);
  }

  function makeRecord(data, theme = "original", name = data.cityName) {
    const now = Date.now();
    return { id: `city-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`}`,
      revision: 0, createdAt: now, updatedAt: now, theme, data: { ...clone(data), schema: 7, cityName: String(name).trim().slice(0, 18) || "未命名小城" } };
  }

  function exportFile(record) {
    return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), city: { name: record.data.cityName, theme: record.theme, createdAt: record.createdAt, data: clone(record.data) } };
  }

  function parseImport(text) {
    if (typeof text !== "string" || text.length > 16 * 1024 * 1024) throw new Error("文件过大，请选择 16 MB 以内的小城文件。");
    let file;
    try { file = JSON.parse(text); } catch { throw new Error("没有读懂这个文件，请选择导出的小城 JSON 文件。"); }
    let source, theme = "imported";
    if (file?.format === FORMAT) {
      if (file.version !== 1) throw new Error("这个文件版本暂不支持，请使用当前版本导出的文件。");
      source = file.city?.data; theme = typeof file.city?.theme === "string" ? file.city.theme : theme;
    } else if ([2, 3, 4, 5, 6, 7].includes(file?.schema)) source = file;
    else throw new Error("这不是可识别的小城文件，原有小城已保留。");
    if (!source || !Array.isArray(source.items) || typeof source.cityName !== "string" || source.items.length > 2000) throw new Error("小城文件缺少名字或布局，或元素超过 2000 个。");
    const ids = new Set();
    for (const item of source.items) {
      if (!item || !TYPES.has(item.type) || !Number.isSafeInteger(item.id) || ids.has(item.id)
        || !Number.isFinite(item.x) || !Number.isFinite(item.y) || Math.abs(item.x) > 1500 || Math.abs(item.y) > 1000) throw new Error("布局中有重复编号、未知素材或无效坐标，请检查文件。");
      ids.add(item.id);
    }
    const data = clone(source);
    Stories.validateProgress(data.progress?.stories);
    if (data.season !== undefined && !Seasons.isSeason(data.season)) throw new Error("小城的季节记录无效，请选择完整的小城备份。");
    data.items = data.items.map((item) => ({ id: item.id, type: item.type, x: item.x,
      y: data.schema === 2 && item.type === "road" ? Math.round((item.y - 12) / 48) * 48 + 12 : item.y,
      rotate: Number.isFinite(item.rotate) ? item.rotate : 0 }));
    data.schema = 7;
    data.cityName = data.cityName.trim().slice(0, 18) || "未命名小城";
    if (!Array.isArray(data.postcards)) data.postcards = [];
    // Imported code and network references can never enter a saved scene or preview.
    for (const card of data.postcards) {
      if (card?.season !== undefined && !Seasons.isSeason(card.season)) throw new Error("明信片的季节记录无效，请选择完整的小城备份。");
      if (card?.pendingScene) throw new Error("这份备份仍有正在生成的明信片，请等画面生成后重新导出。");
      if (card?.image && (typeof card.image !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(card.image) || card.image.length > 350000)) throw new Error("明信片画面格式无效，请选择完整的小城备份。");
    }
    if (data.postcards.length > 24 || (data.journal && (!Array.isArray(data.journal) || data.journal.length > 100))) throw new Error("纪念册或日记超出可恢复的数量。");
    if (data.photos !== undefined) Roaming.validatePhotos(data.photos);
    return { data, theme: ["original", "forest", "waterfront", "garden", "empty", "imported"].includes(theme) ? theme : "imported" };
  }

  function conflictError() { const error = new Error("这座小城已在另一个页面更新。请重新载入，或把当前改动保留为副本。"); error.name = "CityConflictError"; return error; }
  function createRepository(indexedDB) {
    let connection;
    function open() {
      if (connection) return connection;
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("cities", { keyPath: "id" });
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("请关闭较早打开的小城页面，再重新载入收藏馆。"));
      });
      return connection;
    }
    async function run(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("cities", mode), store = transaction.objectStore("cities");
        let result, failure;
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(failure || transaction.error || new Error("保存未完成，请重试。"));
        transaction.onerror = () => {};
        action(store, (value) => { result = value; }, (error) => { failure = error; transaction.abort(); });
      });
    }
    return {
      async list() { return run("readonly", (store, result) => { store.getAll().onsuccess = (event) => result(event.target.result); }); },
      async get(id) { return run("readonly", (store, result) => { store.get(id).onsuccess = (event) => result(event.target.result || null); }); },
      async create(record) {
        const entry = clone({ ...record, revision: 1 });
        return run("readwrite", (store, result) => { store.add(entry); result(entry); });
      },
      async save(record, expectedRevision) {
        const entry = clone(record);
        return run("readwrite", (store, result, fail) => {
          store.get(entry.id).onsuccess = (event) => {
            if (!event.target.result || event.target.result.revision !== expectedRevision) { fail(conflictError()); return; }
            entry.revision = expectedRevision + 1; entry.updatedAt = Date.now();
            store.put(entry); result(entry);
          };
        });
      },
      // On upgrade concurrent tabs must agree on the same preserved original city.
      async seed(record) {
        const entry = clone({ ...record, revision: 1 });
        return run("readwrite", (store, result) => {
          store.count().onsuccess = (event) => {
            if (event.target.result === 0) { store.add(entry); result(entry); }
            else store.openCursor().onsuccess = (cursor) => result(cursor.target.result.value);
          };
        });
      },
    };
  }
  return { templates, buildTemplate, uniqueName, makeRecord, exportFile, parseImport, createRepository, DB_NAME };
});
