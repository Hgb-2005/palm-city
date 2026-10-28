(() => {
  const ACTIVE_CITY_KEY = "palm-city-active-v7";
  const LEGACY_KEYS = ["palm-city-state-v6", "palm-city-state-v5", "palm-city-state-v4", "palm-city-state-v3", "palm-city-state-v2-1", "palm-city-state-v2"];
  const ROAD_STEP = 48;
  const ROAD_ORIGIN_Y = 12;
  let life = PalmCityLife.createSimulation();
  let environment = PalmCityWeather.createEnvironment();
  let visitors = PalmCityVisitors.createSimulation();
  const collection = PalmCityCollection.createRepository(window.indexedDB);
  const svg = document.getElementById("citySvg");
  const world = document.getElementById("world");
  const itemsLayer = document.getElementById("items");
  const groundLayer = document.getElementById("groundItems");
  const gridLayer = document.getElementById("gridLines");
  const stage = document.getElementById("stage");
  const placementCursor = document.getElementById("placementCursor");
  const placementPreview = document.getElementById("placementPreview");
  const placementFeedback = document.getElementById("placementFeedback");
  const buildEffects = document.getElementById("buildEffects");
  const focusSelection = document.getElementById("focusSelection");
  const editHistory = PalmCityBuilding.createHistory();
  const stageEmpty = document.getElementById("stageEmpty");
  const editToolbar = document.getElementById("editToolbar");
  const paletteList = document.getElementById("paletteList");
  const cityName = document.getElementById("cityName");
  const saveState = document.getElementById("saveState");
  const selectedHint = document.getElementById("selectedHint");
  const itemCount = document.getElementById("itemCount");
  const buildingCount = document.getElementById("buildingCount");
  const natureCount = document.getElementById("natureCount");
  const lastEdited = document.getElementById("lastEdited");
  const undoButton = document.getElementById("undoButton");
  const redoButton = document.getElementById("redoButton");
  const deleteButton = document.getElementById("deleteButton");
  const selectedCard = document.getElementById("selectedCard");
  const selectedName = document.getElementById("selectedName");
  const selectedSymbol = document.getElementById("selectedSymbol");
  const selectedPosition = document.getElementById("selectedPosition");
  const toast = document.getElementById("toast");
  const zoomValue = document.getElementById("zoomValue");
  const coordinateHint = document.getElementById("coordinateHint");

  const catalog = {
    house: { label: "小屋", symbol: "⌂", category: "building" },
    shop: { label: "小商店", symbol: "▥", category: "building" },
    tree: { label: "树木", symbol: "✦", category: "nature" },
    road: { label: "小路", symbol: "╱", category: "building" },
    flower: { label: "花坛", symbol: "❀", category: "nature" },
    water: { label: "水面", symbol: "≈", category: "nature" },
    bench: { label: "长椅", symbol: "☷", category: "public" },
    lamp: { label: "路灯", symbol: "♧", category: "public" },
    plaza: { label: "小广场", symbol: "✳", category: "public" },
    pavilion: { label: "凉亭", symbol: "⌑", category: "public" },
    garden: { label: "小花园", symbol: "⚘", category: "nature" },
    dock: { label: "小码头", symbol: "⚑", category: "public" },
  };

  const initialItems = [
    { id: 1, type: "house", x: -144, y: -84 },
    { id: 2, type: "house", x: -48, y: -84 },
    { id: 3, type: "house", x: 48, y: -84 },
    { id: 4, type: "shop", x: 144, y: -84 },
    { id: 5, type: "road", x: -144, y: 12 },
    { id: 6, type: "road", x: -96, y: 12 },
    { id: 7, type: "road", x: -48, y: 12 },
    { id: 8, type: "road", x: 0, y: 12 },
    { id: 9, type: "road", x: 48, y: 12 },
    { id: 10, type: "road", x: 96, y: 12 },
    { id: 11, type: "road", x: 144, y: 12 },
    { id: 13, type: "road", x: -144, y: -36 },
    { id: 14, type: "road", x: -48, y: -36 },
    { id: 15, type: "road", x: 48, y: -36 },
    { id: 16, type: "road", x: 144, y: -36 },
    { id: 17, type: "tree", x: 270, y: 92 },
    { id: 18, type: "flower", x: -252, y: 100 },
    { id: 19, type: "water", x: 96, y: 126 },
    { id: 20, type: "pavilion", x: -48, y: 60 },
    { id: 21, type: "garden", x: -144, y: 126 },
    { id: 22, type: "dock", x: -384, y: 12 },
    { id: 23, type: "road", x: -192, y: 12 },
    { id: 24, type: "road", x: -240, y: 12 },
    { id: 25, type: "road", x: -288, y: 12 },
    { id: 26, type: "road", x: -336, y: 12 },
    { id: 27, type: "road", x: -144, y: 60 },
    { id: 28, type: "bench", x: -240, y: 60 },
    { id: 29, type: "tree", x: -312, y: 84 },
  ];

  function defaultState() { return {
    items: cloneItems(initialItems),
    cityName: "风从这里来",
    selectedId: null,
    activeType: null,
    editMode: "select",
    zoom: 1,
    panX: 0,
    panY: 0,
    lastEdited: Date.now(),
    minutes: 9 * 60,
    paused: false,
    viewMode: false,
    selectedResidentId: null,
    journal: [],
    postcards: [],
    photos: [],
    season: "spring",
    focusedWishId: null,
    selectedGardenId: null,
    sound: false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }; }
  let state = defaultState();
  let drag = null;
  let toastTimer;
  let nextId = Date.now();
  let lastFrame = null;
  let uiElapsed = 0;
  let clockSaveElapsed = 0;
  let animationSeconds = 0;
  let rosterKey = "";
  let photoUrl = null;
  let wishUiKey = "";
  let storyUiKey = "";
  let journalUiKey = "";
  let journalExpanded = false;
  let gardenUiKey = "";
  let rainAudio = null;
  let visitorUiKey = "";
  let travelUiKey = "";
  let travelExpanded = false;
  const pendingCaptures = new Set();
  const residentNodes = new Map();
  const residentPaintKeys = new WeakMap();
  let sceneryDepths = [], depthPaintKey = "";
  let currentCity = null;
  let cityRecords = [];
  let ready = false;
  let collectionBusy = false;
  let saveBlocked = false;
  let saveChain = Promise.resolve(true);
  let collectionMode = "gallery";
  let formCityId = null;
  let selectedTheme = "forest";
  const captureTasks = new Set();
  const touchPointers = new Map();
  let touchCommandRelease = null;
  let followResidentId = null;
  let cameraTarget = null;
  let cameraPreset = "overview";
  let albumUiKey = "";
  let photoDraft = null;
  let photoDraftCityId = null;
  let deletedPhoto = null;
  let capturingPhoto = false;
  let guideUiKey = "", guideNetworkKey = "", guideNetwork = null, guideAction = null, guideCollapsed = false;
  let placementPreviewKey = "", buildEffectTimer;

  function cloneItems(items) { return items.map((item) => ({ ...item })); }

  function readState(saved, legacy = false) {
    try {
      if (!saved) return;
      if (Array.isArray(saved.items)) {
        state.items = saved.items.filter((item) => item && catalog[item.type] && Number.isFinite(item.id) && Number.isFinite(item.x) && Number.isFinite(item.y)).map((item) => ({
          id: item.id, type: item.type, x: item.x,
          y: legacy && item.type === "road" ? Math.round((item.y - ROAD_ORIGIN_Y) / ROAD_STEP) * ROAD_STEP + ROAD_ORIGIN_Y : item.y,
          rotate: Number.isFinite(item.rotate) ? item.rotate : 0,
        }));
      }
      state.cityName = typeof saved.cityName === "string" ? saved.cityName.slice(0, 18) : state.cityName;
      state.zoom = PalmCityRoaming.clampZoom(saved.zoom);
      state.panX = Number(saved.panX) || 0;
      state.panY = Number(saved.panY) || 0;
      state.lastEdited = Number(saved.lastEdited) || Date.now();
      if (Number.isFinite(saved.minutes)) state.minutes = ((saved.minutes % 1440) + 1440) % 1440;
      state.paused = saved.paused === true;
      state.sound = saved.sound === true;
      if (typeof saved.reducedMotion === "boolean") state.reducedMotion = saved.reducedMotion;
      environment.restore(saved.environment);
      life.restoreProgress(saved.progress);
      visitors.restore(saved.visitors);
      state.photos = PalmCityRoaming.cleanPhotos(saved.photos);
      state.season = PalmCitySeasons.normalize(saved.season);
      state.postcards = Array.isArray(saved.postcards) ? saved.postcards.filter((card) => card && typeof card.id === "string" && Number.isFinite(card.createdAt)).slice(0, 24).map((card) => ({
        id: card.id.slice(0, 100), number: Math.max(1, Math.floor(Number(card.number) || 1)), name: "阿远",
        cityName: typeof card.cityName === "string" ? card.cityName.slice(0, 18) : state.cityName,
        title: typeof card.title === "string" ? card.title.slice(0, 40) : "第一次来访",
        quote: typeof card.quote === "string" ? card.quote.slice(0, 80) : "把风景带回远方。",
        text: typeof card.text === "string" ? card.text.slice(0, 120) : "在小城，慢慢走过。",
        createdAt: card.createdAt, clock: typeof card.clock === "string" ? card.clock.slice(0, 5) : "09:00",
        weather: card.weather === "rain" ? "rain" : "sunny",
        ...(PalmCitySeasons.isSeason(card.season) ? { season: card.season } : {}),
        image: typeof card.image === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(card.image) && card.image.length < 350000 ? card.image : null,
        // Pending captures are rendered as inert SVG images, never inserted into the page as markup.
        pendingScene: typeof card.pendingScene === "string" && card.pendingScene.startsWith("<svg ") && card.pendingScene.length < 800000 ? card.pendingScene : null,
      })) : [];
      travelUiKey = ""; visitorUiKey = "";
      state.journal = Array.isArray(saved.journal) ? saved.journal.filter((entry) => entry && typeof entry.id === "string" && typeof entry.text === "string" && typeof entry.title === "string" && Number.isFinite(entry.createdAt)).slice(0, 100).map((entry) => ({
        id: entry.id.slice(0, 100), title: entry.title.slice(0, 60), text: entry.text.slice(0, 120), quote: typeof entry.quote === "string" ? entry.quote.slice(0, 80) : "", kind: ["shade", "meeting", "lamplight", "rain-bloom", "garden", "story"].includes(entry.kind) ? entry.kind : "shade", ...(PalmCitySeasons.isSeason(entry.season) ? { season: entry.season } : {}), createdAt: entry.createdAt, clock: typeof entry.clock === "string" ? entry.clock.slice(0, 5) : "09:00",
      })) : [];
    } catch (error) { console.info("Unable to read saved city", error); }
  }

  function cityData() {
    return JSON.parse(JSON.stringify({ schema: 7, items: editHistory.pendingItems || state.items, cityName: state.cityName, season: state.season, zoom: state.zoom, panX: state.panX, panY: state.panY, lastEdited: state.lastEdited, minutes: state.minutes, paused: state.paused, progress: life.progress(), journal: state.journal, environment: environment.save(), visitors: visitors.save(), postcards: state.postcards, photos: state.photos, sound: state.sound, reducedMotion: state.reducedMotion }));
  }

  function writeState() {
    if (!currentCity || !ready || saveBlocked) return Promise.resolve(false);
    const record = currentCity, data = cityData();
    saveState.textContent = "正在保存…";
    saveChain = saveChain.then(async () => {
      if (saveBlocked) return false;
      try {
        const saved = await collection.save({ ...record, data }, record.revision);
        Object.assign(record, saved);
        if (record === currentCity) saveState.textContent = "已保存 · 此座小城";
        return true;
      } catch (error) {
        saveBlocked = true;
        saveState.textContent = "尚未保存 · 请保留副本";
        document.getElementById("collectionNotice").hidden = false;
        document.getElementById("collectionNoticeText").textContent = error.name === "CityConflictError" ? error.message : "小城暂时未能保存。可以导出备份，或将当前改动保留为副本后重试。";
        console.warn("Unable to save city", error);
        return false;
      }
    });
    return saveChain;
  }

  function persist() {
    updateCollectionBar();
    writeState();
  }

  function updateCollectionBar() {
    document.getElementById("currentCityName").textContent = state.cityName;
    document.getElementById("collectionBarNote").textContent = `${Math.max(1, cityRecords.length)} 座小城 · 每一座，都可以慢慢长大`;
    const index = cityRecords.findIndex((record) => record.id === currentCity?.id);
    document.getElementById("archiveNumber").textContent = `NO. ${String(index + 1 || 1).padStart(3, "0")}`;
    updateHistoryUI();
    const caption = document.getElementById("mobileBuildCaption");
    caption.hidden = !state.activeType && state.editMode !== "move";
    document.getElementById("mobileBuildText").textContent = state.activeType ? `${catalog[state.activeType].symbol} ${catalog[state.activeType].label} · 按住看落点，轻点放置` : "✥ 移动模式 · 拖动预览，松手安放";
  }

  function miniature(data, theme) {
    const palette = PalmCityCollection.templates.find((entry) => entry.id === theme)?.colors || ["#e7e5cf", "#98ab83"];
    const season = PalmCitySeasons.get(data.season);
    const items = data.items || [];
    const roads = items.filter((item) => item.type === "road");
    const paths = roads.map((road) => {
      const links = roads.filter((other) => (Math.abs(road.x - other.x) < 1 && Math.abs(Math.abs(road.y - other.y) - 48) < 1) || (Math.abs(road.y - other.y) < 1 && Math.abs(Math.abs(road.x - other.x) - 48) < 1));
      return links.length ? links.map((other) => `M${road.x} ${road.y}L${other.x} ${other.y}`).join("") : `M${road.x - 20} ${road.y}h40`;
    }).join("");
    const objects = [...items].sort((a, b) => a.y - b.y).map((item) => {
      let mark = "";
      if (["house", "shop"].includes(item.type)) {
      const kind = item.type === "house" ? PalmCityDesign.houseStyle(item, items).kind : "shop";
        const roof = { waterfront: "#7c9b9e", garden: "#94a381", forest: "#7e9276", row: "#b78267", cottage: "#b77f61", shop: "#819e8c" }[kind];
        const upper = kind === "row" ? 14 : 0;
        mark = `<rect x="-22" y="${-12 - upper}" width="44" height="${35 + upper}" rx="3" fill="#f8e8bd"/><path d="M-28 ${-11 - upper}L0 ${-36 - upper}L28 ${-11 - upper}Z" fill="${roof}"/><rect x="-4" y="7" width="8" height="16" fill="#9c9070"/><path d="M-15-2h8v8h-8m22-8h8v8h-8${upper ? 'M-15-19h8v8h-8m22-8h8v8h-8' : ''}" fill="#adbbb1"/>`;
      }
      else if (item.type === "tree") mark = `<rect x="-3" y="-7" width="6" height="26" rx="3" fill="#9b8661"/><circle cy="-16" r="23" fill="${season.tree[0]}"/><circle cx="-8" cy="-23" r="13" fill="${season.tree[1]}"/>${PalmCitySeasons.treeDecor(data.season, item.id)}`;
      else if (item.type === "water") mark = '<ellipse cy="8" rx="43" ry="21" fill="#a0c6b8"/><path d="M-23 6q10-5 20 0m6 7q10-5 20 0" fill="none" stroke="#d1e3d2" stroke-width="2"/>';
      else if (["garden", "flower"].includes(item.type)) mark = `<ellipse cy="7" rx="29" ry="16" fill="${item.type === "garden" ? "#bda682" : "#bec68b"}"/><g fill="${item.type === "garden" ? "#d8be8e" : "#d2a28f"}"><circle cx="-16" cy="1" r="5"/><circle cy="-4" r="5"/><circle cx="15" cy="4" r="5"/></g>`;
      else if (item.type === "pavilion") mark = '<path d="M-25-12V23m50-35v35" stroke="#aa8d69" stroke-width="4"/><path d="M-37-10L0-44L37-10Z" fill="#789786"/><ellipse cy="24" rx="34" ry="12" fill="#c4ba98"/>';
      else if (item.type === "dock") mark = '<path d="M-58-7H14V14H-58Z" fill="#bc9c6b"/><path d="M11-7V-45m0 0l25 8-25 8" fill="#be8d68" stroke="#a28b65" stroke-width="2"/>';
      else if (item.type === "bench") mark = '<path d="M-24-8H24m-24 13h48" stroke="#b88c62" stroke-width="7"/><path d="M-18 6v11M18 6v11" stroke="#7e8b70" stroke-width="3"/>';
      else if (item.type === "lamp") mark = '<path d="M0 14V-31" stroke="#75836a" stroke-width="3"/><circle cy="-32" r="7" fill="#efd29a"/>';
      else if (item.type === "plaza") mark = '<ellipse cy="7" rx="36" ry="20" fill="#e5d9b9" stroke="#c1b795" stroke-width="2"/>';
      return mark ? `<g transform="translate(${item.x} ${item.y})">${mark}</g>` : "";
    }).join("");
    return `<svg viewBox="-530 -310 1060 620" role="img" aria-label="${season.label}小城布置缩略图"><rect x="-530" y="-310" width="1060" height="620" fill="${palette[0]}"/><ellipse cy="32" rx="438" ry="220" fill="#a4b181" opacity=".3"/><ellipse cy="8" rx="437" ry="221" fill="${season.side[0]}"/><ellipse cy="-5" rx="437" ry="220" fill="${season.land[0]}"/><path d="${paths}" fill="none" stroke="#c0b38b" stroke-width="17" stroke-linecap="round"/><path d="${paths}" fill="none" stroke="#e8dec1" stroke-width="11" stroke-linecap="round"/>${objects}${!items.length ? '<text y="10" text-anchor="middle" fill="#99a17d" font-size="20">故事，等你开始</text>' : ""}</svg>`;
  }

  function renderGallery() {
    document.getElementById("collectionCount").textContent = `${cityRecords.length} 座小城，各有各的日常`;
    document.getElementById("cityGallery").innerHTML = cityRecords.map((record, index) => {
      const data = record.id === currentCity?.id ? cityData() : record.data;
      const active = record.id === currentCity?.id;
      const themeLabel = PalmCityCollection.templates.find((entry) => entry.id === record.theme)?.name || (record.theme === "imported" ? "远方来信" : "最初的小城");
      const label = `${themeLabel} · ${PalmCitySeasons.get(data.season).label}`;
      return `<article class="collected-city ${active ? "is-current" : ""}" data-city-id="${record.id}"><button type="button" class="city-cover" data-switch-city="${record.id}" aria-label="继续建造${escapeHtml(data.cityName)}">${miniature(data, record.theme)}<span class="city-cover-label">${active ? "● 正在建造" : label}</span><span class="city-cover-number">${String(index + 1).padStart(2, "0")}</span></button><div class="collected-city-copy"><div><h3>${escapeHtml(data.cityName)}</h3><button type="button" data-rename-city="${record.id}" aria-label="重命名${escapeHtml(data.cityName)}">✎</button></div><p>${Math.min(5, data.items.filter((item) => item.type === "house").length)} 位居民 <i>·</i> ${data.journal?.length || 0} 篇日记 <i>·</i> ${data.postcards?.length || 0} 张明信片</p><div class="collected-city-actions"><button type="button" data-switch-city="${record.id}">${active ? "回到小城" : "继续建造"} ↗</button><button type="button" data-copy-city="${record.id}">复制</button><button type="button" data-export-city="${record.id}">备份 ↗</button></div></div></article>`;
    }).join("") + '<button type="button" class="gallery-add-city" data-new-city><span>＋</span><strong>再收藏一种生活</strong><small>林间、水岸、花园，或从空岛开始</small></button>';
  }

  function showCollectionError(error) {
    const target = document.getElementById("collectionError");
    target.textContent = error.message || String(error); target.hidden = false;
  }

  async function collectionWork(action) {
    if (collectionBusy) return;
    collectionBusy = true;
    document.body.classList.add("collection-busy");
    document.getElementById("collectionError").hidden = true;
    try { await action(); }
    catch (error) { showCollectionError(error); showToast(error.message || "操作未完成，请再试一次。"); }
    finally { collectionBusy = false; lastFrame = null; document.body.classList.remove("collection-busy"); updateSeasonUI(); updateRoamUI(); }
  }

  async function flushCity() {
    if (cancelBuildGesture()) render();
    await Promise.allSettled([...captureTasks]);
    if (followResidentId || cameraTarget) stopFollowing(false);
    if (!await writeState()) throw new Error("当前改动还没有保存。请先点击「保留当前为副本」或导出备份。");
  }

  function activateCity(record) {
    clearBuildFeedback();
    editHistory.clear(); hidePlacementPreview();
    guideUiKey = guideNetworkKey = ""; guideNetwork = guideAction = null; guideCollapsed = false;
    document.getElementById("guideContent").hidden = false;
    document.getElementById("toggleGuide").textContent = "收起 −";
    document.getElementById("toggleGuide").setAttribute("aria-expanded", "true");
    currentCity = record;
    state = defaultState();
    life = PalmCityLife.createSimulation();
    environment = PalmCityWeather.createEnvironment();
    visitors = PalmCityVisitors.createSimulation();
    readState(record.data);
    followResidentId = cameraTarget = photoDraft = photoDraftCityId = deletedPhoto = null;
    cameraPreset = Object.keys(PalmCityRoaming.presets).find((key) => Math.abs(PalmCityRoaming.presets[key].zoom - state.zoom) < .02) || "custom";
    albumUiKey = "";
    document.body.classList.remove("is-following");
    document.getElementById("albumDialog").close();
    document.getElementById("roamPhotoDialog").close();
    saveBlocked = false;
    document.getElementById("collectionNotice").hidden = true;
    rosterKey = wishUiKey = storyUiKey = journalUiKey = gardenUiKey = visitorUiKey = travelUiKey = "";
    journalExpanded = travelExpanded = false;
    drag = null; touchPointers.clear(); clockSaveElapsed = uiElapsed = animationSeconds = 0; lastFrame = null;
    closeMobileDrawers();
    document.body.classList.remove("is-viewing");
    document.getElementById("viewButton").innerHTML = '<span aria-hidden="true">◉</span> <span class="button-label">观赏小城</span>';
    document.getElementById("viewButton").setAttribute("aria-label", "观赏小城");
    document.getElementById("viewButton").title = "观赏小城";
    document.getElementById("viewButton").setAttribute("aria-pressed", "false");
    document.getElementById("modeLabel").textContent = "正在建造";
    document.getElementById("photoDialog").close();
    cityName.value = state.cityName;
    try { localStorage.setItem(ACTIVE_CITY_KEY, record.id); } catch (error) { console.info(error); }
    updateActiveCard(); render(); updateLighting(); updateWeatherUI(); updateCollectionBar();
    saveState.textContent = "已保存 · 此座小城";
    state.postcards.filter((card) => card.pendingScene && !card.image).forEach(finishPostcard);
  }

  async function openCollection(mode = "gallery", sourceId = currentCity?.id) {
    if (!ready) return;
    closeMobileDrawers();
    await collectionWork(async () => {
      if (!saveBlocked) await flushCity();
      cityRecords = await collection.list();
      cityRecords.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      setCollectionMode(mode, sourceId);
      const dialog = document.getElementById("collectionDialog");
      if (!dialog.open) dialog.showModal();
    });
  }

  function setCollectionMode(mode, sourceId) {
    collectionMode = mode; formCityId = sourceId;
    document.getElementById("collectionError").hidden = true;
    document.getElementById("cityFormError").textContent = "";
    const form = document.getElementById("cityCreateForm");
    document.getElementById("collectionGallery").hidden = mode !== "gallery";
    form.hidden = mode === "gallery";
    document.getElementById("collectionTitle").textContent = ({ gallery: "我的小城收藏馆", new: "再收藏一种生活", copy: "从喜欢的地方，再出发", rename: "给小城换一个名字" })[mode];
    document.getElementById("collectionSubtitle").textContent = mode === "copy" ? "建筑、花园和故事一起复制。接下来的改建，各自珍藏。" : "原来的城，好好留着。新的日子，慢慢搭建。";
    if (mode === "gallery") { renderGallery(); return; }
    const source = cityRecords.find((record) => record.id === sourceId) || currentCity;
    document.getElementById("templateChoices").hidden = mode !== "new";
    document.getElementById("copyCitySummary").hidden = mode === "new";
    document.getElementById("copyCitySummary").innerHTML = source ? `${miniature(source.id === currentCity?.id ? cityData() : source.data, source.theme)}<p>${mode === "rename" ? "保留这座小城的所有布置与生活，只换一个名字。" : "创建一座独立副本，原来的小城会保留。"}</p>` : "";
    const name = mode === "new" ? PalmCityCollection.templates.find((item) => item.id === selectedTheme).cityName : mode === "copy" ? `${source.data.cityName.slice(0, 14)} 副本` : source.data.cityName;
    document.getElementById("newCityName").value = mode === "rename" ? name : PalmCityCollection.uniqueName(name, cityRecords.map((record) => record.data.cityName));
    document.getElementById("createCityHint").textContent = mode === "rename" ? "历史明信片上的旧城名会保留，下一次来信会写下新名字。" : "所有布置都可以继续改建，原来的小城会保留。";
    document.getElementById("confirmCreateCity").textContent = mode === "rename" ? "保存名字 ✓" : mode === "copy" ? "复制并开始改建 ↗" : "收藏这座小城 ↗";
    renderTemplateChoices();
  }

  function renderTemplateChoices() {
    document.getElementById("templateChoices").innerHTML = PalmCityCollection.templates.map((theme) => `<button type="button" class="template-choice ${selectedTheme === theme.id ? "is-selected" : ""}" data-theme="${theme.id}" aria-pressed="${selectedTheme === theme.id}">${miniature(PalmCityCollection.buildTemplate(theme.id), theme.id)}<span><strong>${theme.name}</strong><small>${theme.description}</small></span><i>${selectedTheme === theme.id ? "✓" : "○"}</i></button>`).join("");
  }

  async function switchCity(id) {
    await collectionWork(async () => {
      if (id !== currentCity.id) { await flushCity(); const record = await collection.get(id); if (!record) throw new Error("这座小城暂时没有找到，请重新打开收藏馆。"); activateCity(record); }
      document.getElementById("collectionDialog").close();
      showToast(`回到「${state.cityName}」，接着慢慢搭建。`);
    });
  }

  async function submitCityForm(event) {
    event.preventDefault();
    const entered = document.getElementById("newCityName").value.trim();
    if (!entered) { document.getElementById("cityFormError").textContent = "先给小城起个名字吧。"; return; }
    await collectionWork(async () => {
      await flushCity();
      const records = await collection.list();
      const name = PalmCityCollection.uniqueName(entered, records.filter((record) => collectionMode !== "rename" || record.id !== formCityId).map((record) => record.data.cityName));
      if (collectionMode === "rename") {
        if (formCityId === currentCity.id) { state.cityName = name; state.lastEdited = Date.now(); cityName.value = name; updateLifeUI(); if (!await writeState()) throw new Error("名字还未保存，请先保留当前副本。"); }
        else { const record = await collection.get(formCityId); record.data.cityName = name; record.data.lastEdited = Date.now(); await collection.save(record, record.revision); }
        cityRecords = await collection.list(); setCollectionMode("gallery"); updateCollectionBar(); showToast("小城有了新名字，故事继续。");
      } else {
        const source = collectionMode === "copy" ? await collection.get(formCityId) : null;
        if (collectionMode === "copy" && !source) throw new Error("没有找到要复制的小城，请回到收藏馆重试。");
        const data = source ? source.data : PalmCityCollection.buildTemplate(selectedTheme);
        const record = await collection.create(PalmCityCollection.makeRecord(data, source?.theme || selectedTheme, name));
        cityRecords = await collection.list(); activateCity(record); document.getElementById("collectionDialog").close();
        showToast(source ? "副本已收藏，放心改建这座小城。" : "新小城已收藏，故事从这里开始。");
      }
    });
  }

  function downloadCity(record) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(PalmCityCollection.exportFile(record), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `掌心小城-${record.data.cityName.replace(/[\\/:*?"<>|]/g, "_")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast("小城备份已导出，导入后会得到一座新副本。");
  }

  async function exportCity(id = currentCity.id) {
    await collectionWork(async () => {
      await Promise.allSettled([...captureTasks]);
      if (!saveBlocked) await flushCity();
      const record = id === currentCity.id ? { ...currentCity, data: cityData() } : await collection.get(id);
      if (record.data.postcards.some((card) => card.pendingScene)) throw new Error("明信片画面还在生成，请稍后再导出备份。");
      downloadCity(record);
    });
  }

  async function importCityFile(file) {
    if (!file) return;
    await collectionWork(async () => {
      if (file.size > 16 * 1024 * 1024) throw new Error("文件过大，请选择 16 MB 以内的小城文件。");
      const parsed = PalmCityCollection.parseImport(await file.text());
      await flushCity();
      const records = await collection.list();
      const name = PalmCityCollection.uniqueName(parsed.data.cityName, records.map((record) => record.data.cityName));
      const record = await collection.create(PalmCityCollection.makeRecord(parsed.data, parsed.theme, name));
      cityRecords = await collection.list(); activateCity(record); document.getElementById("collectionDialog").close(); await writeState();
      showToast("小城已作为新副本收藏，原有小城都在。");
    });
    document.getElementById("importCityFile").value = "";
  }

  async function rescueCity() {
    await collectionWork(async () => {
      await Promise.allSettled([...captureTasks]); await saveChain;
      const records = await collection.list();
      const name = PalmCityCollection.uniqueName(`${state.cityName.slice(0, 14)} 副本`, records.map((record) => record.data.cityName));
      const record = await collection.create(PalmCityCollection.makeRecord(cityData(), currentCity.theme, name));
      cityRecords = await collection.list(); activateCity(record); showToast("当前改动已保留为副本，其他页面的存档也在。");
    });
  }

  function closeMobileDrawers() {
    document.body.classList.remove("mobile-build-open", "mobile-archive-open");
    document.getElementById("mobileDrawerShade").hidden = true;
    document.getElementById("mobileBuild").setAttribute("aria-expanded", "false");
    document.getElementById("mobileArchive").setAttribute("aria-expanded", "false");
  }

  function toggleMobileDrawer(kind) {
    const wasOpen = document.body.classList.contains(`mobile-${kind}-open`);
    closeMobileDrawers();
    if (wasOpen) return;
    document.body.classList.add(`mobile-${kind}-open`);
    document.getElementById("mobileDrawerShade").hidden = false;
    document.getElementById(kind === "build" ? "mobileBuild" : "mobileArchive").setAttribute("aria-expanded", "true");
  }

  function enableTouchCommand(button) {
    let start = null, releasedAt = -Infinity;
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" && !button.disabled) start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    button.addEventListener("pointercancel", () => { start = null; });
    button.addEventListener("pointerup", (event) => {
      const began = start; start = null;
      if (event.pointerType !== "touch" || !began || began.id !== event.pointerId || button.disabled || Math.hypot(event.clientX - began.x, event.clientY - began.y) > 10) return;
      // A toolbar command remains immediate after dragging the canvas, even when
      // the browser suppresses the next compatibility click after that gesture.
      event.preventDefault(); releasedAt = performance.now();
      touchCommandRelease = { id: event.pointerId, time: releasedAt };
      button.click();
    });
    button.addEventListener("click", (event) => {
      if (event.isTrusted && event.detail > 0 && performance.now() - releasedAt < 600) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }

  // A command can hide or move its own panel before the browser emits its click.
  // Consume only that same finger's compatibility click, including a retargeted one.
  document.addEventListener("click", (event) => {
    if (event.isTrusted && touchCommandRelease && event.pointerId === touchCommandRelease.id && performance.now() - touchCommandRelease.time < 700) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);

  function snapshot(label) { editHistory.begin(state.items, label); updateHistoryUI(); }

  function clearBuildFeedback() {
    clearTimeout(buildEffectTimer);
    buildEffects.replaceChildren();
  }

  function showBuildFeedback(before, after) {
    clearBuildFeedback();
    if (state.reducedMotion) return;
    const changes = PalmCityBuilding.layoutChanges(before, after);
    const oldItems = new Map(before.map(item => [item.id, item]));
    for (const item of after) {
      const old = oldItems.get(item.id);
      if (!old || changes.some(change => change.id === item.id)) continue;
      const style = item.type === "house" ? PalmCityDesign.houseStyle : PalmCityDesign.cornerStyle;
      if (style(old, before)?.kind !== style(item, after)?.kind) changes.push({ ...item, kind: "detail" });
    }
    buildEffects.innerHTML = changes.slice(0, 16).map(item => `<g class="build-feedback" data-kind="${item.kind}" transform="translate(${item.x} ${item.y})"><ellipse class="build-ripple" cy="8" rx="${item.type === "road" ? 27 : 45}" ry="${item.type === "road" ? 14 : 24}"/><path class="build-spark" d="M0-43v10m-5-5h10M-32-19v6m-3-3h6M33-26v6m-3-3h6"/></g>`).join("");
    buildEffectTimer = setTimeout(clearBuildFeedback, 780);
  }

  function commitLayout() {
    const before = editHistory.pendingItems;
    const changed = editHistory.commit(state.items);
    if (changed && before) showBuildFeedback(before, state.items);
    return changed;
  }

  function updateHistoryUI() {
    for (const button of [undoButton, document.getElementById("mobileUndo")]) {
      button.disabled = state.viewMode || !editHistory.canUndo;
      button.title = editHistory.canUndo ? `撤销${editHistory.undoLabel}（Ctrl / ⌘ Z）` : "暂无可撤销的布置";
    }
    for (const button of [redoButton, document.getElementById("mobileRedo")]) {
      button.disabled = state.viewMode || !editHistory.canRedo;
      button.title = editHistory.canRedo ? `重做${editHistory.redoLabel}（Ctrl / ⌘ Shift Z）` : "暂无可重做的布置";
    }
  }

  function cancelBuildGesture() {
    const previous = editHistory.cancel();
    if (previous) state.items = previous;
    drag = null; touchPointers.clear();
    stage.classList.remove("is-panning"); hidePlacementPreview();
    return !!previous;
  }

  function formatPosition(item) { return `${Math.round(item.x)}, ${Math.round(item.y)}`; }

  function setWorldTransform() {
    world.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
    zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function resizeViewport() {
    const rect = stage.getBoundingClientRect();
    const box = PalmCityRoaming.viewport(rect.width, rect.height, window.matchMedia("(max-width: 760px)").matches);
    const value = `${box.x} ${box.y} ${box.width} ${box.height}`;
    if (svg.getAttribute("viewBox") === value) return;
    const canceled = drag ? cancelBuildGesture() : false;
    svg.setAttribute("viewBox", value);
    if (canceled) render();
    setWorldTransform();
  }

  function drawGrid() {
    let markup = "";
    for (let x = -384; x <= 384; x += 48) markup += `<line x1="${x}" y1="-240" x2="${x}" y2="204" />`;
    for (let y = -228; y <= 204; y += 48) markup += `<line x1="-420" y1="${y}" x2="420" y2="${y}" />`;
    gridLayer.innerHTML = markup;
  }

  function roadConnections(item) {
    return PalmCityDesign.roadDirections(item, state.items);
  }

  function pathForDirections(directions, length = 27) {
    return PalmCityDesign.roadPath(directions, length);
  }

  function roadNearBuilding(item) {
    const roads = state.items.filter((candidate) => candidate.type === "road");
    return PalmCityLife.entrances(item, roads)[0] || null;
  }

  function buildingWalk(item) {
    const road = roadNearBuilding(item);
    if (!road) return "";
    const entries = new Map([[road.id, road]]);
    for (const resident of life.residents) {
      if (!resident.plan) continue;
      const points = resident.plan.points;
      const entry = resident.homeId === item.id ? points[1] : resident.plan.shopId === item.id ? points[points.length - 2] : null;
      if (entry) entries.set(entry.roadId, entry);
    }
    return [...entries.values()].map((entry) => {
      const door = PalmCityLife.doorPoint(item, entry);
      return `<path class="front-path" d="M${door.x} ${door.y} L${entry.x} ${entry.y}" />`;
    }).join("");
  }

  function renderHouse(style) {
    const upper = style.kind === "row", roofY = upper ? -20 : -4;
    const window = (x, y, width = 10) => `<rect class="house-window" x="${x}" y="${y}" width="${width}" height="10" rx="1.6"/><path d="M${x + width / 2} ${y}v10M${x} ${y + 5}h${width}" class="window-frame"/>`;
    let detail = "";
    if (style.kind === "waterfront") detail = '<path d="M-35 28H35V35H-35Z" fill="#c4ab83" stroke="#9d8a6a"/><path d="M-29 25V35M-16 29V35M16 29V35M29 25V35M-31 26H-9M9 26H31" fill="none" stroke="#f3ead2" stroke-width="2"/><circle cx="26" cy="12" r="5" fill="#f4e7ce" stroke="#b67e66" stroke-width="2"/><path d="M23 9l6 6m-6 0l6-6" stroke="#b67e66" stroke-width="1"/>';
    else if (style.kind === "garden") detail = '<path d="M-29 27Q-38 11-28-7Q-23-17-31-27" fill="none" stroke="#7b9470" stroke-width="2.4"/><path d="M-30 15q-13-6-5-12q10 1 5 12m1-17q-6-10 3-12q7 4-3 12" fill="#98ac79"/><g fill="#d5988b"><circle cx="-30" cy="-10" r="3"/><circle cx="-34" cy="8" r="3"/></g><path d="M-21 13h15l-2 6h-11m25-6h15l-2 6H8" fill="#a78263"/><g fill="#90a26d"><ellipse cx="-14" cy="12" rx="9" ry="3"/><ellipse cx="14" cy="12" rx="9" ry="3"/></g><g fill="#e9b7a5"><circle cx="-17" cy="10" r="2"/><circle cx="-11" cy="10" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="18" cy="10" r="2"/></g>';
    else if (style.kind === "forest") detail = '<path d="M-25 18h14m22 0h14M-25 23h14m22 0h14" stroke="#ac9271" stroke-width="1" opacity=".5"/><path d="M-35 27H35M-30 27V33M30 27V33" stroke="#a78c66" stroke-width="3" stroke-linecap="round"/><path d="M28-12l6-7 6 7v11H28Z" fill="#c5a77d" stroke="#8d8060"/><circle cx="34" cy="-9" r="2.5" fill="#756e52"/>';
    else if (upper) detail = `${window(-19, -16)}${window(9, -16)}<path d="M-26-1H26" stroke="#cfb192" stroke-width="2"/><path d="M-32 27H32M-27 27V31M27 27V31" stroke="#a98966" stroke-width="2.5"/><path d="M-25 20h9l-1 7h-7" fill="#b88b70"/><path d="M-21 21v-8m0 6l-5-4m5 1l5-5" stroke="#8ca372" stroke-width="2"/><circle cx="-16" cy="10" r="2.5" fill="#d4aa87"/>`;
    else detail = '<path d="M-36 29v-16h9v8h-9" stroke="#9b8f72" stroke-width="2" fill="#b2bc94"/><path d="M-35 15h7" stroke="#f5ecd8" stroke-width="1"/>';
    return `<ellipse class="item-shadow" cx="3" cy="33" rx="38" ry="9"/><g filter="url(#tinyShadow)"><path class="house-chimney" d="M15 ${roofY - 11}v-23h9v32"/><path class="house-base" d="M-28 ${roofY}L0 ${roofY - 18}L28 ${roofY}V27H-28Z"/><path class="house-side" d="M21 ${roofY - 4}L28 ${roofY}V27L21 22Z"/><path class="house-roof" d="M-34 ${roofY}L0 ${roofY - 32}L34 ${roofY}L27 ${roofY + 5}L0 ${roofY - 21}L-27 ${roofY + 5}Z"/><path class="roof-highlight" d="M-28 ${roofY - 1}L0 ${roofY - 25}L28 ${roofY - 1}"/><ellipse class="window-glow" cy="6" rx="30" ry="22"/>${window(-19, 2)}${window(9, 2)}<rect class="house-door" x="-5" y="9" width="10" height="18" rx="2"/><path d="M-7 28H7M-10 31H10" stroke="#bba17b" stroke-width="2"/><circle cx="2" cy="18" r="1" fill="#efcf96"/>${detail}</g><text class="item-label" y="49">${style.label}</text>`;
  }

  function renderItem(item) {
    const selected = item.id === state.selectedId;
    const meta = catalog[item.type];
    const rot = item.rotate || 0;
    const style = item.type === "house" ? PalmCityDesign.houseStyle(item, state.items) : null;
    const corner = PalmCityDesign.cornerStyle(item, state.items);
    const groupStart = `<g class="item-group ${style ? `house-${style.kind}` : ""} ${selected ? "is-selected" : ""}" data-item-id="${item.id}" ${style ? `data-house-style="${style.kind}"` : ""} ${corner ? `data-corner-style="${corner.kind}"` : ""} transform="translate(${item.x} ${item.y}) rotate(${rot})">`;
    const ring = `<ellipse class="selection-ring" cx="0" cy="7" rx="${item.type === "road" ? 38 : item.type === "water" ? 58 : 43}" ry="${item.type === "water" ? 27 : 32}" />`;
    let body = "";
    if (item.type === "house") {
      body = renderHouse(style);
    } else if (item.type === "shop") {
      body = `<ellipse class="item-shadow" cx="4" cy="32" rx="37" ry="9" /><g filter="url(#tinyShadow)"><path class="shop-base" d="M-32-1 L32-1 L27 30 L-27 30Z" /><path class="shop-side" d="M25 0 L32-1 L27 30 L22 26Z" /><path class="shop-roof" d="M-35-5 L0-28 L35-5 L30 1 L0-19 L-30 1Z" /><ellipse class="window-glow" cx="0" cy="17" rx="34" ry="18"/><path class="shop-awning" d="M-30 0 L30 0 L26 9 L-26 9Z" /><rect class="shop-window" x="-18" y="11" width="15" height="12" rx="2" /><rect class="shop-window" x="4" y="11" width="15" height="12" rx="2" /><path d="M-10 0V9M0 0V9M10 0V9" stroke="#f3d2ae" stroke-width="2" /></g><text class="item-label" y="48">${meta.label}</text>`;
    } else if (item.type === "tree") {
      body = `<ellipse class="item-shadow" cx="2" cy="33" rx="28" ry="8" /><g filter="url(#tinyShadow)"><ellipse class="tree-trunk" cx="0" cy="23" rx="6" ry="16" /><circle class="tree-crown" cx="-12" cy="-5" r="21" /><circle class="tree-crown" cx="13" cy="-6" r="22" /><circle class="tree-crown-light" cx="0" cy="-25" r="20" /><circle cx="-7" cy="-26" r="3" fill="#d9e3a1" opacity=".68" /><circle cx="12" cy="-12" r="3" fill="#d9e3a1" opacity=".68" /></g><text class="item-label" y="51">${meta.label}</text>`;
    } else if (item.type === "bench") {
      body = `<ellipse class="item-shadow" cy="16" rx="31" ry="8"/><path d="M-23 3V19M23 3V19" stroke="#5a6655" stroke-width="4" stroke-linecap="round"/><rect x="-31" y="-17" width="62" height="8" rx="3" fill="#ad7e51"/><rect x="-31" y="-7" width="62" height="7" rx="2" fill="#c29360"/><path d="M-30 3H30L26 10H-27Z" fill="#d2a875"/><path d="M-27-17V5M27-17V5" stroke="#69725a" stroke-width="3"/><text class="item-label" y="37">长椅</text>`;
    } else if (item.type === "lamp") {
      body = `<ellipse class="lamp-pool" cx="0" cy="7" rx="72" ry="35" fill="#ffe6a2"/><ellipse class="item-shadow" cy="12" rx="15" ry="5"/><path d="M-8 12H8M0 10V-52" stroke="#566654" stroke-width="5" stroke-linecap="round"/><ellipse class="lamp-halo" cy="-56" rx="25" ry="29" fill="#ffe6a2"/><path d="M-10-65H10L7-47H-7Z" class="lamp-glass"/><path d="M-13-65L0-74L13-65ZM-8-46H8" fill="#627058" stroke="#566654" stroke-width="2"/><text class="item-label" y="34">路灯</text>`;
    } else if (item.type === "plaza") {
      body = `<ellipse class="item-shadow" cy="12" rx="47" ry="27"/><ellipse cx="0" cy="4" rx="47" ry="30" fill="#c2b699" stroke="#a9a083" stroke-width="2"/><ellipse cx="0" cy="2" rx="43" ry="26" fill="#e7ddc4"/><path d="M-39-7H39M-42 7H42M-24-18L-18 24M0-23V28M24-18L18 24" stroke="#c8bda2" stroke-width="1.2"/><path d="M0-9L3-1L12 2L3 5L0 13L-3 5L-12 2L-3-1Z" fill="#b3bd8a"/><text class="item-label" y="45">小广场</text>`;
    } else if (item.type === "pavilion") {
      body = `<ellipse class="item-shadow" cy="27" rx="48" ry="12"/><ellipse cx="0" cy="20" rx="43" ry="22" fill="#c7bca0" stroke="#b3a889" stroke-width="2"/><path d="M-32-21V22M32-21V22M-23-30V6M23-30V6" stroke="#927854" stroke-width="5" stroke-linecap="round"/><path d="M-28 9H28" stroke="#a98e65" stroke-width="6"/><path d="M-48-19L0-58L48-19L35-12L0-37L-35-12Z" fill="#6e8d7e" stroke="#557666" stroke-width="2"/><path d="M0-58V-40M-39-20H39M-24-31H24" stroke="#9fb2a0" stroke-width="2"/><path d="M-48-19Q0 2 48-19" fill="none" stroke="#617b66" stroke-width="4"/><text class="item-label" y="48">凉亭</text>`;
    } else if (item.type === "dock") {
      body = `<ellipse class="item-shadow" cx="-18" cy="21" rx="65" ry="13"/><path d="M-77 11Q-51 23-24 18M-81 26Q-60 34-44 29" fill="none" stroke="#93b4a9" stroke-width="2" opacity=".65"/><path d="M-68-9L17-9L24 12L-64 12Z" fill="#bc986d" stroke="#987c5b" stroke-width="1.5"/><path d="M-65 12H24V18H-65Z" fill="#94744f"/><path d="M-51-8V12M-36-8V12M-21-8V12M-6-8V12M9-8V12" stroke="#dec099" stroke-width="1.4"/><path d="M-64-11V24M14-11V24" stroke="#79684f" stroke-width="5" stroke-linecap="round"/><path d="M-64-11H14" stroke="#e5d1a3" stroke-width="2"/><path d="M12-11V-58" stroke="#74674f" stroke-width="3"/><path d="M14-56L40-49L14-39Z" fill="#bd795d"/><circle cx="-63" cy="-12" r="4" fill="#dac49b"/><text class="item-label" y="43">小码头</text>`;
    } else if (item.type === "garden") {
      body = renderGarden(item);
    } else if (item.type === "road") {
      const path = pathForDirections(roadConnections(item));
      const label = selected ? `<text class="item-label" y="39">${meta.label}</text>` : "";
      body = `<path class="road-hit" d="${path}" />${label}`;
    } else if (item.type === "flower") {
      body = `<ellipse class="item-shadow" cx="0" cy="26" rx="34" ry="8" /><g filter="url(#tinyShadow)"><ellipse class="flower-ground" cx="0" cy="7" rx="32" ry="19" /><g class="flower-dot"><circle cx="-16" cy="2" r="5" /><circle cx="-3" cy="-6" r="5" /><circle cx="10" cy="2" r="5" /><circle cx="1" cy="11" r="5" /></g><g class="flower-dot alt"><circle cx="-9" cy="10" r="4" /><circle cx="18" cy="-5" r="4" /></g><circle cx="-16" cy="2" r="2" fill="#f8e0a7" /><circle cx="-3" cy="-6" r="2" fill="#f8e0a7" /><circle cx="10" cy="2" r="2" fill="#f8e0a7" /></g><text class="item-label" y="36">${meta.label}</text>`;
    } else if (item.type === "water") {
      body = `<ellipse class="item-shadow" cx="0" cy="28" rx="55" ry="10" /><g filter="url(#tinyShadow)"><ellipse class="water-body" cx="0" cy="7" rx="53" ry="24" /><path class="water-shine" d="M-30 2 Q-15-5 0 2 M8 13 Q22 6 35 12" /><g class="rain-ripples" fill="none" stroke="#dcece3" stroke-width="1.4"><ellipse class="rain-ripple" cx="-19" cy="4" rx="11" ry="5"/><ellipse class="rain-ripple" style="animation-delay:-.7s" cx="21" cy="13" rx="9" ry="4"/><ellipse class="rain-ripple" style="animation-delay:-1.4s" cx="9" cy="-1" rx="7" ry="3"/></g></g><text class="item-label" y="43">${meta.label}</text>`;
    }
    if (corner) {
      const decor = {
        shade: '<path d="M-38 16q-9-8-10 1q4 7 10-1M32 24q5-10 10-3q-1 6-10 3M-10 25q-8-2-6 4q6 3 6-4" fill="var(--tree-color, #9fb68b)"/>',
        waterside: '<path d="M-42 23q-5-13-2-28m5 27q4-12 1-20m-9 19q-8-7-8-16" fill="none" stroke="#90a27c" stroke-width="1.8"/><path d="M-44-12v9m5-1v8" stroke="#af926e" stroke-width="4" stroke-linecap="round"/><ellipse cx="37" cy="22" rx="6" ry="3" fill="#b9b4a0"/>',
        lamplit: '<path d="M33 8h15l-3 15h-9Z" fill="#bc9678"/><path d="M40 10V-4m0 9q-13-8-9-13m9 15q12-6 10-12" fill="none" stroke="#91a279" stroke-width="2"/><g fill="#d8afa0"><circle cx="40" cy="-5" r="4"/><circle cx="32" cy="-8" r="3"/><circle cx="49" cy="-5" r="3"/></g>',
        florist: '<path d="M-23 20h19l-2 6h-15m27-6h19l-2 6H8" fill="#ad8765"/><g fill="#8fa476"><ellipse cx="-14" cy="19" rx="10" ry="3"/><ellipse cx="15" cy="19" rx="10" ry="3"/></g><g fill="#d7a395"><circle cx="-18" cy="16" r="3"/><circle cx="-10" cy="17" r="2.5"/><circle cx="10" cy="16" r="2.5"/><circle cx="20" cy="17" r="3"/></g>',
      };
      body += `<g class="corner-decor" pointer-events="none">${decor[corner.kind]}</g>`;
    }
    if (item.type === "tree") body += PalmCitySeasons.treeDecor(state.season, item.id);
    if (state.season === "winter") body += PalmCitySeasons.snowCap(item.type, style?.kind === "row");
    if (["house", "shop", "pavilion"].includes(item.type)) body += `<g class="roof-drips" fill="#c9e0dc" pointer-events="none"><path class="roof-drop" d="M-28 0q-4 7 0 7q4 0 0-7Z"/><path class="roof-drop" style="animation-delay:-.8s" d="M28-2q-4 7 0 7q4 0 0-7Z"/></g>`;
    return `${groupStart}${ring}${body}</g>`;
  }

  function renderGarden(item) {
    const garden = environment.garden(item.id);
    const stageName = garden?.stage || "empty";
    const stems = [[-24, 0], [-8, -10], [12, -5], [27, 8], [-7, 13]];
    const plants = stems.map(([x, y], index) => {
      if (stageName === "empty") return `<path d="M${x - 4} ${y}h8" stroke="#a08b6e" stroke-width="2" stroke-linecap="round"/>`;
      if (stageName === "seed") return `<ellipse cx="${x}" cy="${y}" rx="2.3" ry="1.6" fill="#ddbe80"/>`;
      const height = stageName === "sprout" ? 10 : 19;
      const blossom = stageName === "bloom" ? `<g fill="${["#d9a1a2", "#e4bc73", "#c8a8c3"][index % 3]}"><circle cx="-4" cy="${-height}" r="4.5"/><circle cx="4" cy="${-height}" r="4.5"/><circle cy="${-height - 4}" r="4.5"/><circle cy="${-height + 4}" r="4.5"/><circle cy="${-height}" r="3" fill="#f9e6b4"/></g>` : stageName === "bud" ? `<ellipse cy="${-height}" rx="3.5" ry="5" fill="#d7b6ac"/>` : "";
      return `<g transform="translate(${x} ${y})"><path d="M0 0V${-height}" stroke="#70885b" stroke-width="2"/><path d="M0-4Q-11-12-9-5Q-5-1 0-4M0-6Q10-16 9-8Q5-4 0-6" fill="#90a877"/>${blossom}</g>`;
    }).join("");
    return `<g class="garden-plot" data-growth-stage="${stageName}"><ellipse class="item-shadow" cy="24" rx="47" ry="12"/><path d="M-47-5L-9-27L47-3L9 27Z" fill="#b9a181"/><path d="M-47-5L9 20L47-3V5L9 30L-47 3Z" fill="#ab9170"/><path d="M-42-5L-9-22L42-3L9 20Z" fill="${garden?.moisture > .1 ? "#897c62" : "#b29c79"}"/><path d="M-30-11L22 10M-14-18L37 3M-38 3L-5-13" stroke="#c2aa83" stroke-width="1" opacity=".5"/>${plants}<text class="item-label" y="47">小花园 · ${{ empty: "待播种", seed: "种子", sprout: "嫩芽", bud: "花苞", bloom: "花开了" }[stageName]}</text></g>`;
  }

  function refreshGardens() {
    for (const item of state.items.filter((candidate) => candidate.type === "garden")) {
      const node = itemsLayer.querySelector(`[data-item-id="${item.id}"]`);
      if (node) node.outerHTML = renderItem(item);
    }
    cacheSceneryDepths();
    gardenUiKey = "";
    updateGardenUI();
  }

  function sortItemsForRender(items) {
    const layer = { water: 0, road: 1, plaza: 1, flower: 2, garden: 2, bench: 3, lamp: 3, house: 3, shop: 3, pavilion: 3, dock: 3, tree: 4 };
    return [...items].sort((a, b) => (a.y - b.y) || (layer[a.type] - layer[b.type]));
  }

  function cacheSceneryDepths() {
    sceneryDepths = state.items.filter(item => !["road", "water", "plaza"].includes(item.type)).map(item => ({ y: item.y + (item.type === "bench" ? 4 : item.type === "lamp" ? 12 : 26), node: itemsLayer.querySelector(`[data-item-id="${item.id}"]`) }));
    depthPaintKey = "";
  }

  function renderRoadNetwork() {
    const roads = state.items.filter((item) => item.type === "road");
    const paths = roads.map((road) => ({ ...road, directions: roadConnections(road) }));
    const layers = ["road-edge", "road-body", "road-mark"].map((name) => paths.map((road) => `<path class="${name}" transform="translate(${road.x} ${road.y})" d="${pathForDirections(road.directions, 24)}"/>`).join("")).join("");
    const junctions = paths.filter((road) => road.directions.length >= 3).map((road) => `<circle class="road-junction" cx="${road.x}" cy="${road.y}" r="4.5"/>`).join("");
    return `<g class="street-network" pointer-events="none">${layers}${junctions}</g>`;
  }

  function updateDesignUI(item) {
    const style = item?.type === "house" ? PalmCityDesign.houseStyle(item, state.items) : PalmCityDesign.cornerStyle(item, state.items);
    const plan = PalmCityDesign.planConnection(item, state.items);
    const connection = PalmCityBuilding.connectionInfo(item, state.items, plan);
    const reachable = `沿现有小路可到 ${connection.homes} 间住宅、${connection.shops} 间商店。`;
    const messages = { connected: `门前的小路已接入主要街道。${reachable}`, "no-roads": "先铺一段小路，再来连接这里。", blocked: "周围没有可通行的路线，挪开一些素材再试试。", ready: `从「门前」到「街道」，点「接路」铺下 ${plan.additions.length} 段。${reachable}` };
    const supported = plan.status !== "unsupported";
    const button = document.querySelector('#editToolbar [data-edit-action="connect"]');
    button.hidden = !supported; button.disabled = plan.status !== "ready";
    button.title = messages[plan.status] || "接通小路";
    document.getElementById("editToolbarLabel").textContent = style?.label || (item ? catalog[item.type].label : "编辑元素");
    document.getElementById("selectionNote").hidden = !item || !supported || state.viewMode;
    document.getElementById("selectionNoteTitle").textContent = `${style?.label || (item ? catalog[item.type].label : "")} · ${connection.title}`;
    document.getElementById("selectionNoteText").textContent = `${style?.detail || ""}${messages[plan.status] || ""}`;
    document.getElementById("selectedDetail").textContent = style?.detail || messages[plan.status] || "";
    if (plan.status === "ready" && !state.viewMode) {
      const points = plan.path.map((point) => `${point.x},${point.y}`).join(" ");
      groundLayer.insertAdjacentHTML("beforeend", `<g class="connection-preview" pointer-events="none"><polyline points="${points}"/>${plan.additions.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5"/>`).join("")}</g>`);
      const start = plan.path[0], end = plan.path.at(-1);
      placementPreview.insertAdjacentHTML("beforeend", `<g class="connection-endpoints" pointer-events="none"><g transform="translate(${start.x} ${start.y})"><path d="M-11 0L0-11L11 0L0 11Z"/><rect x="-24" y="15" width="48" height="23" rx="7"/><text y="31">门前</text></g><g transform="translate(${end.x} ${end.y})"><path d="M-10-10H10V10H-10Z"/><rect x="-24" y="-39" width="48" height="23" rx="7"/><text y="-23">街道</text></g></g>`);
    }
  }

  function connectSelected() {
    if (state.viewMode || drag) return;
    const item = state.items.find((entry) => entry.id === state.selectedId);
    const plan = PalmCityDesign.planConnection(item, state.items);
    if (plan.status !== "ready") return;
    snapshot("接路");
    for (const point of plan.additions) addRoadAt(point);
    commitLayout();
    state.lastEdited = Date.now();
    render(); persist();
    const info = PalmCityBuilding.connectionInfo(item, state.items, { status: "connected" });
    showToast(`已铺下 ${plan.additions.length} 段，可达 ${info.homes} 间住宅、${info.shops} 间商店`);
  }

  function render() {
    placementPreviewKey = "";
    placementPreview.querySelectorAll(".connection-endpoints").forEach(node => node.remove());
    updateSeasonUI();
    environment.sync(state.items);
    life.sync(state.items);
    syncStoryContext();
    life.setWeather(environment.weather.kind);
    syncVisitors();
    groundLayer.innerHTML = state.items.filter((item) => ["water", "plaza"].includes(item.type)).map(renderItem).join("") + renderRoadNetwork()
      + state.items.filter((item) => item.type === "road").map(renderItem).join("")
      + state.items.filter((item) => ["house", "shop", "bench", "plaza", "pavilion", "garden", "dock"].includes(item.type)).map(buildingWalk).join("");
    itemsLayer.innerHTML = sortItemsForRender(state.items.filter((item) => !["water", "road", "plaza"].includes(item.type))).map(renderItem).join("")
      + life.residents.map(renderResident).join("") + renderVisitor();
    residentNodes.clear();
    life.residents.forEach((resident) => residentNodes.set(resident.id, document.getElementById(resident.id)));
    cacheSceneryDepths();
    renderResidentPositions();
    updateLifeUI();
    updateGardenUI();
    updateVisitorUI();
    updateTravelUI();
    updatePersonalAlbum();
    updateRoamUI();
    itemCount.textContent = state.items.length;
    buildingCount.textContent = state.items.filter((item) => ["building", "public"].includes(catalog[item.type].category) && item.type !== "road").length;
    natureCount.textContent = state.items.filter((item) => catalog[item.type].category === "nature").length;
    lastEdited.textContent = "刚刚";
    stageEmpty.hidden = state.items.length > 0;
    updateHistoryUI();
    deleteButton.disabled = state.selectedId == null;
    editToolbar.hidden = state.selectedId == null || state.viewMode;
    const selectedItem = state.items.find((item) => item.id === state.selectedId);
    stage.classList.toggle("has-selection", !!selectedItem && !state.viewMode);
    updateDesignUI(selectedItem);
    document.querySelectorAll('[data-edit-action="rotate"]').forEach((button) => {
      button.disabled = selectedItem?.type === "road";
      button.title = selectedItem?.type === "road" ? "小路方向由相邻道路决定" : "旋转 90 度";
    });
    stage.classList.toggle("is-editing", state.editMode === "move");
    if (selectedItem) {
      const meta = catalog[selectedItem.type];
      selectedCard.hidden = false;
      selectedName.textContent = (selectedItem.type === "house" ? PalmCityDesign.houseStyle(selectedItem, state.items) : PalmCityDesign.cornerStyle(selectedItem, state.items))?.label || meta.label;
      selectedSymbol.textContent = meta.symbol;
      selectedPosition.textContent = `坐标 ${formatPosition(selectedItem)}`;
      selectedHint.textContent = `${meta.label} · ${formatPosition(selectedItem)}`;
    } else {
      selectedCard.hidden = true;
      selectedHint.textContent = state.activeType ? `准备放置 · ${catalog[state.activeType].label}` : "请选择一个元素";
    }
    setWorldTransform();
    updateCollectionBar();
  }

  function updateActiveCard() {
    hidePlacementPreview();
    document.querySelectorAll(".palette-card").forEach((card) => card.classList.toggle("is-active", card.dataset.type === state.activeType));
    if (state.activeType) {
      placementCursor.style.display = "block";
      stage.classList.add("is-placement-mode");
    } else {
      placementCursor.style.display = "none";
      stage.classList.remove("is-placement-mode");
    }
    updateCollectionBar();
  }

  function chooseMaterial(type) {
    cancelBuildGesture();
    state.activeType = type;
    state.selectedId = null;
    state.selectedResidentId = null;
    state.editMode = "select";
    const allTab = document.querySelector('[data-category="all"]');
    allTab.click();
    updateActiveCard();
    closeMobileDrawers();
    render();
    showToast(type === "road" ? "从相连的小路拖向设施，留约一格的入口" : `点击小岛，放置${catalog[type].label}`);
  }

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function drawRain() {
    document.getElementById("rainLayer").innerHTML = Array.from({ length: 64 }, (_, index) => {
      const x = (index * 173 % 1280) - 640;
      const y = (index * 137 % 780) - 390;
      return `<path class="rain-streak" d="M${x} ${y}l-9 23" style="animation-delay:-${(index % 17) * .13}s;animation-duration:${.9 + index % 4 * .19}s"/>`;
    }).join("");
  }

  function updateSeasonUI() {
    const season = PalmCitySeasons.get(state.season), card = document.getElementById("stageCard");
    card.dataset.season = svg.dataset.season = state.season;
    card.style.setProperty("--season-accent", season.color);
    card.style.setProperty("--season-paper", season.paper);
    ["--tree-color", "--tree-light", "--tree-edge"].forEach((key, i) => svg.style.setProperty(key, season.tree[i]));
    document.getElementById("seasonSymbol").textContent = season.symbol;
    document.getElementById("seasonTitle").textContent = season.title;
    document.getElementById("seasonHint").textContent = season.hint;
    document.querySelectorAll("[data-season-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.seasonChoice === state.season));
      button.setAttribute("aria-label", `切换到${PalmCitySeasons.label(button.dataset.seasonChoice)}`);
      button.disabled = !ready || saveBlocked || collectionBusy;
    });
    document.getElementById("seasonGround").innerHTML = PalmCitySeasons.groundDecor(state.season);
  }

  function changeSeason(season) {
    if (!ready || saveBlocked || collectionBusy || !PalmCitySeasons.isSeason(season) || state.season === season) return;
    state.season = season;
    render(); updateLighting(); persist();
    showToast(`${PalmCitySeasons.label(season)}到了，去同一个街角看看吧。`);
  }

  function updateWeatherUI() {
    if (state.reducedMotion) clearBuildFeedback();
    document.querySelectorAll("[data-season-choice]").forEach((button) => { button.disabled = !ready || saveBlocked || collectionBusy; });
    const weather = environment.weather;
    const raining = weather.kind === "rain";
    const card = document.getElementById("stageCard");
    card.dataset.weather = weather.kind;
    card.classList.toggle("is-still", state.reducedMotion);
    card.classList.toggle("is-time-paused", state.paused || document.hidden);
    document.getElementById("weatherTitle").textContent = raining ? "小雨，借一处屋檐听听" : "晴日，适合慢慢走";
    document.getElementById("weatherMark").textContent = raining ? "☂" : "☀";
    document.querySelector(".weather-panel").classList.toggle("is-raining", raining);
    document.getElementById("weatherHint").textContent = raining ? "邻居撑伞去避雨，花园正喝着雨水。" : "雨停后继续散步，照料过的花会慢慢开放。";
    document.querySelectorAll("button[data-weather]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.weather === weather.kind)));
    const auto = document.getElementById("weatherAuto");
    auto.textContent = weather.auto ? "Ⅱ 暂停天气" : "▷ 继续轮换";
    auto.setAttribute("aria-label", weather.auto ? "暂停天气自动轮换" : "继续天气自动轮换");
    auto.setAttribute("aria-pressed", String(weather.auto));
    document.getElementById("weatherNext").textContent = state.paused ? "小城已暂停 · 花园也歇一会儿" : weather.auto ? `${Math.ceil(weather.duration - weather.elapsed)} 秒后${raining ? "雨停，天放晴" : "，一场小雨"}` : "天气保持 · 仍可手动切换";
    document.getElementById("weatherProgress").style.width = `${weather.elapsed / weather.duration * 100}%`;
    const sound = document.getElementById("rainSound");
    sound.textContent = state.sound ? rainAudio ? "♪ 雨声：开" : "♪ 点击续听雨声" : "♪ 雨声：关";
    sound.setAttribute("aria-pressed", String(state.sound));
    document.getElementById("motionButton").textContent = state.reducedMotion ? "动态：静止" : "动态：轻柔";
    document.getElementById("motionButton").setAttribute("aria-pressed", String(state.reducedMotion));
    updateRainAudio();
  }

  function changeWeather(kind) {
    if (!environment.setWeather(kind)) return;
    life.setWeather(kind);
    syncVisitors();
    updateWeatherUI(); updateLighting(); updateLifeUI(); updateGardenUI(); updateVisitorUI();
    persist();
    showToast(kind === "rain" ? "一场小雨来了，邻居会沿路去避雨。" : "雨停了，花园会记得这一场雨。" );
  }

  function updateGardenUI() {
    const plots = state.items.filter((item) => item.type === "garden");
    const selected = plots.find((item) => item.id === state.selectedId) || plots.find((item) => item.id === state.selectedGardenId) || plots[0];
    if (selected) state.selectedGardenId = selected.id;
    const garden = selected ? environment.garden(selected.id) : null;
    const stageNames = { empty: "留一小块地，等一颗种子", seed: "种子 · 把日子种下去", sprout: "嫩芽 · 已经探出头了", bud: "花苞 · 再等一点点阳光", bloom: "花开了 · 谢谢你的照料" };
    const signature = plots.map((item) => item.id).join("|") + JSON.stringify([selected?.id, garden?.stage, garden?.moisture >= .95, state.paused, environment.weather.kind]);
    if (signature !== gardenUiKey) {
      gardenUiKey = signature;
      document.getElementById("gardenCare").innerHTML = !garden ? `<div class="garden-empty"><span>⚘</span><p>从一小块地开始。播种，等雨，<br/>也可以亲手浇一点水。</p></div><div class="garden-actions"><button type="button" data-place-environment="garden">＋ 种一块花园</button><button type="button" data-place-environment="pavilion">＋ 添座凉亭</button></div>` : `<div class="garden-picker"><span>⚘</span><label for="gardenSelect" class="sr-only">选择要照料的花园</label><select id="gardenSelect">${plots.map((item, index) => `<option value="${item.id}" ${item.id === selected.id ? "selected" : ""}>第 ${index + 1} 块小花园</option>`).join("")}</select><button type="button" data-garden-action="focus" data-garden-id="${selected.id}" aria-label="在画布上查看这块花园">↗</button></div><strong class="garden-stage">${stageNames[garden.stage]}</strong><div class="garden-growth" role="progressbar" aria-label="花园成长" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="garden-meters"><span id="gardenGrowthText"></span><span id="gardenWaterText"></span></div><div class="garden-actions"><button type="button" data-garden-action="sow" data-garden-id="${selected.id}" ${garden.planted ? "disabled" : ""}>${garden.planted ? "✓ 已播种" : "⚘ 播下种子"}</button><button type="button" data-garden-action="water" data-garden-id="${selected.id}" ${!garden.planted || garden.growth >= 1 || garden.moisture >= .95 ? "disabled" : ""}>♧ 浇一点水</button></div><p class="garden-tip">${state.paused ? "点击上方「继续」，花园就会慢慢长大。" : garden.stage === "bloom" ? "花会一直开着。离开几天，也不用担心。" : environment.weather.kind === "rain" ? "雨水正在照料它。雨停后，再等一朵花。" : "浇水或等一场小雨。离开几天也不会枯萎。"}</p>`;
    }
    if (garden) {
      const percent = Math.floor(garden.growth * 100);
      const bar = document.querySelector(".garden-growth");
      bar.setAttribute("aria-valuenow", String(percent));
      bar.firstElementChild.style.width = `${percent}%`;
      document.getElementById("gardenGrowthText").textContent = `成长 ${percent}%`;
      document.getElementById("gardenWaterText").textContent = garden.stage === "bloom" ? "不用再浇水" : environment.weather.kind === "rain" && garden.planted ? "雨水浇灌中" : garden.moisture > .1 ? "土壤湿润" : "等一点水";
    }
  }

  async function toggleRainSound() {
    if (state.sound && rainAudio) state.sound = false;
    else {
      try {
        if (!rainAudio) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          const audio = new Audio();
          const buffer = audio.createBuffer(1, audio.sampleRate * 3, audio.sampleRate);
          const data = buffer.getChannelData(0);
          for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
          const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
          const filter = audio.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1500;
          const gain = audio.createGain(); gain.gain.value = 0;
          source.connect(filter); filter.connect(gain); gain.connect(audio.destination); source.start();
          rainAudio = { audio, gain, playing: false };
        }
        await rainAudio.audio.resume();
        state.sound = true;
      } catch (error) { state.sound = false; showToast("这个浏览器暂时无法播放雨声。"); }
    }
    updateWeatherUI(); persist();
  }

  function updateRainAudio() {
    if (!rainAudio) return;
    const playing = state.sound && environment.weather.kind === "rain" && !state.paused && !document.hidden;
    if (playing === rainAudio.playing) return;
    rainAudio.playing = playing;
    rainAudio.gain.gain.setTargetAtTime(playing ? .12 : 0, rainAudio.audio.currentTime, .4);
  }

  function updateWishesUI() {
    const wishes = life.wishes();
    const signature = JSON.stringify(wishes.map(({ id, status, conditions }) => ({ id, status, conditions }))) + state.focusedWishId + state.paused;
    if (signature === wishUiKey) return;
    wishUiKey = signature;
    const completed = wishes.filter((wish) => wish.status === "completed").length;
    document.getElementById("wishesCount").textContent = wishes.length ? `${completed} / ${wishes.length} 个心愿已实现` : "住进邻居，就会有新的心愿";
    document.getElementById("wishList").innerHTML = wishes.length ? wishes.map((wish) => `<button type="button" class="wish-card ${wish.status === "completed" ? "is-complete" : ""} ${state.focusedWishId === wish.id ? "is-focused" : ""}" data-wish-id="${wish.id}" aria-expanded="${state.focusedWishId === wish.id}"><span class="wish-card-top"><span>${wish.symbol} ${wish.name}的心愿</span><i>${({ available: "待回应", preparing: "布置中", ready: "准备出发", visiting: "正在实现", completed: "已实现 ✓" })[wish.status]}</i></span><strong>${wish.title}</strong><small>${wish.status === "completed" ? "谢谢你，把心愿变成日常。" : wish.quote}</small></button>`).join("") : '<p class="wishes-empty">先安放一间小屋，等邻居带来小小心愿。</p>';
    const guide = document.getElementById("wishGuide");
    const selected = wishes.find((wish) => wish.id === state.focusedWishId);
    guide.hidden = !selected;
    if (!selected) return;
    const statusText = selected.status === "completed" ? `“${selected.thanks}” · 这份心意已收进小城日记。` : selected.status === "available" ? "不用着急，也没有期限。愿意的话，就替邻居留一个喜欢的角落。" : state.paused && selected.ready ? "布置好了。点击上方「继续」，等邻居走来。" : selected.status === "visiting" ? "邻居已经出发，等他亲自用过这里，心愿就会实现。" : selected.ready ? "一切都准备好了，邻居马上会沿着小路走来。" : "将设施放在小路旁约一格处，让家门口的小路一路连到这里。";
    const tools = selected.kind === "meeting" ? ["plaza", "road"] : selected.kind === "lamplight" ? ["bench", "lamp", "road"] : ["tree", "bench", "road"];
    guide.innerHTML = `<div class="wish-guide-top"><p>${statusText}</p><button type="button" data-close-wish aria-label="收起心愿详情">×</button></div>${selected.status === "completed" ? `<div class="wish-tools"><button type="button" data-memory-id="wish:${selected.id}">保存这一页纪念卡 ↗</button></div>` : `<div class="wish-conditions">${selected.conditions.map((condition) => `<span class="${condition.done ? "is-done" : ""}">${condition.done ? "✓" : "○"} ${condition.label}</span>`).join("")}</div><div class="wish-tools">${selected.status === "available" ? `<button type="button" class="accept-wish" data-accept-wish="${selected.id}">帮${selected.name}实现 ♡</button>` : tools.map((type) => `<button type="button" data-wish-material="${type}">${catalog[type].symbol} 安放${catalog[type].label}</button>`).join("")}${selected.kind === "lamplight" && selected.status !== "available" ? '<button type="button" data-wish-night>☾ 看看夜晚</button>' : ""}</div>`}`;
  }

  function syncStoryContext() {
    life.setStoryContext({ season: state.season, gardens: state.items.filter(item => item.type === "garden").map(item => environment.garden(item.id)).filter(Boolean) });
  }

  function updateStoriesUI() {
    const chapter = life.story(), progress = life.progress().stories;
    const savedMemory = state.journal.find(entry => entry.id === `story:${chapter.season}`);
    const signature = JSON.stringify([chapter.season, chapter.status, chapter.name, chapter.conditions, progress, state.paused, saveBlocked, collectionBusy, !!savedMemory]);
    if (signature === storyUiKey) return;
    storyUiKey = signature;
    const panel = document.getElementById("storiesPanel");
    panel.dataset.season = chapter.season;
    document.getElementById("storiesCount").textContent = `${progress.filter(entry => entry.completed).length} / 4 页回忆`;
    document.getElementById("storySeasons").innerHTML = Object.entries(PalmCityStories.chapters).map(([season, story]) => {
      const record = progress.find(entry => entry.season === season);
      const status = record?.completed ? "已珍藏" : record ? "待续" : "待相遇";
      return `<button type="button" data-story-season="${season}" aria-pressed="${season === chapter.season}" aria-label="${story.label}故事：${story.title}，${status}"><span aria-hidden="true">${record?.completed ? "✓" : story.symbol}</span><span>${story.label}<small>${status}</small></span></button>`;
    }).join("");
    const completed = chapter.status === "completed";
    const status = completed ? "这一页，已经珍藏" : !chapter.name ? "等一位邻居住进来" : chapter.status === "available" ? "一份新的小小约定" : environment.weather.kind === "rain" ? "先听雨，放晴再出发" : state.paused ? "小城暂停中，故事也歇一会儿" : chapter.status === "visiting" ? "邻居正赴约，等他停留一会儿" : chapter.ready ? "布置好了，等邻居完成手边的事再出门" : "慢慢布置，等一个好日子";
    document.getElementById("openStories").textContent = completed ? "翻翻这一季的故事 ↓" : "听听这一季的故事 ↓";
    document.getElementById("storyCard").innerHTML = `<article class="story-card ${completed ? "is-complete" : ""}"><div class="story-vignette" aria-hidden="true"><span class="story-orbit">${chapter.symbol}</span><svg viewBox="0 0 128 100"><ellipse cx="65" cy="82" rx="51" ry="12" fill="currentColor" opacity=".1"/><path d="M22 78h83M31 67h46m-43-9h42m-38 9v14m32-14v14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M94 77V38" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="94" cy="32" r="8" fill="currentColor" opacity=".3"/><path d="M18 63V44" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="35" r="15" fill="currentColor" opacity=".35"/><circle cx="23" cy="29" r="10" fill="currentColor" opacity=".2"/></svg><small>${chapter.label}的一页</small></div><div class="story-copy"><span class="story-status">${status}</span><h3>${chapter.title}</h3><p class="story-quote">“${completed ? escapeHtml(savedMemory?.quote || chapter.thanks) : chapter.quote}”</p><span class="story-neighbor">${completed ? "写给这座小城的感谢" : chapter.name ? `${chapter.name}的小小期待` : "放下一间小屋，故事就会开始"}</span></div><div class="story-action">${completed ? `${savedMemory ? `<button type="button" data-memory-id="story:${chapter.season}">保存这一页 ↗</button>` : '<span class="story-saved">这份回忆已珍藏 ♡</span>'}` : `<button type="button" data-story-accept ${!chapter.name || chapter.status !== "available" || saveBlocked || collectionBusy ? "disabled" : ""}>${chapter.status === "available" ? "陪邻居完成 ♡" : "约定已记下 ♡"}</button>`}${chapter.name && !completed ? `<button type="button" class="story-find" data-resident-select="${chapter.residentId}">看看${chapter.name} ↗</button>` : ""}</div></article>${completed ? '<p class="story-complete-note">你留下一个角落，邻居留下一句谢谢。这一天也写进了小城日记。</p>' : `<ul class="story-checklist" aria-label="故事需要的布置">${chapter.conditions.map(condition => `<li class="${condition.done ? "is-done" : ""}"><span aria-hidden="true">${condition.done ? "✓" : "○"}</span>${condition.label}<span class="sr-only">${condition.done ? "，已准备" : "，待准备"}</span></li>`) .join("")}</ul><div class="story-materials">${chapter.materials.map(type => `<button type="button" data-wish-material="${type}">${catalog[type].symbol} 安放${catalog[type].label}</button>`).join("")}${chapter.season === "winter" ? '<button type="button" data-wish-night>☾ 看看夜晚</button>' : ""}${chapter.season === "spring" ? '<button type="button" data-story-garden>⚘ 去照料花园 ↗</button>' : ""}</div>`}`;
  }

  function updateJournalUI() {
    const signature = state.journal.map((entry) => entry.id).join("|") + journalExpanded;
    if (signature === journalUiKey) return;
    journalUiKey = signature;
    document.getElementById("journalCount").textContent = `${state.journal.length} 个片刻`;
    document.getElementById("journalList").innerHTML = state.journal.length ? state.journal.slice(0, journalExpanded ? 100 : 3).map((entry) => `<article class="journal-entry"><span class="journal-date">${new Date(entry.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} · ${escapeHtml(entry.clock)}</span><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.text)}</p><button type="button" data-memory-id="${escapeHtml(entry.id)}">保存纪念卡 ↗</button></article>`).join("") : '<div class="journal-empty"><span>✎</span><p>第一篇日记，等一个小心愿。<br/>回应邻居，留个喜欢的角落吧。</p></div>';
    const more = document.getElementById("journalMore");
    more.hidden = state.journal.length <= 3;
    more.textContent = journalExpanded ? "收起日记 ↑" : `翻开其余 ${state.journal.length - 3} 个片刻 ↓`;
  }

  function guideInput() {
    const layoutKey = state.items.map(item => `${item.id},${item.type},${item.x},${item.y},${item.rotate || 0}`).join("|");
    if (layoutKey !== guideNetworkKey || !guideNetwork) { guideNetworkKey = layoutKey; guideNetwork = PalmCityLife.createNetwork(state.items); }
    const hour = state.minutes / 60;
    return { items: state.items, gardens: environment.save().gardens, chapter: life.story(), progress: life.progress().stories, paused: state.paused, rain: environment.weather.kind === "rain", night: hour < 7 || hour >= 20, selectedId: state.selectedId, network: guideNetwork };
  }

  function updateGuideUI() {
    if (drag) return;
    const input = guideInput();
    const signature = JSON.stringify([guideNetworkKey, input.chapter.status, input.chapter.homeId, input.chapter.name, input.chapter.season, input.progress, input.gardens.map(garden => [garden.id, garden.planted, Math.floor(garden.growth * 100), garden.moisture > .1]), input.paused, input.rain, input.night, input.selectedId, state.viewMode, collectionBusy, saveBlocked]);
    if (signature === guideUiKey) return;
    guideUiKey = signature;
    const suggestion = PalmCityGuide.suggest(input);
    guideAction = suggestion.action;
    document.getElementById("cityGuide").dataset.step = suggestion.id;
    document.getElementById("guideTitle").textContent = suggestion.title;
    document.getElementById("guideText").textContent = suggestion.text;
    const button = document.getElementById("guideAction");
    button.textContent = suggestion.button; button.disabled = saveBlocked || collectionBusy || state.viewMode;
    document.getElementById("guideMilestones").innerHTML = suggestion.milestones.map(step => `<li class="${step.done ? "is-done" : ""}"><span aria-hidden="true">${step.done ? "✓" : "○"}</span>${step.label}<span class="sr-only">${step.done ? "，已准备" : "，待准备"}</span></li>`).join("");
  }

  function runGuideAction() {
    if (state.viewMode || drag || saveBlocked || collectionBusy || !guideAction) return;
    const action = PalmCityGuide.suggest(guideInput()).action;
    if (JSON.stringify(action) !== JSON.stringify(guideAction)) { guideUiKey = ""; updateGuideUI(); return; }
    const showStage = () => stage.scrollIntoView({ block: "center", behavior: state.reducedMotion ? "instant" : "smooth" });
    if (action.kind === "material") { chooseMaterial(action.type); showStage(); }
    if (action.kind === "focus") {
      const item = state.items.find(item => item.id === action.itemId);
      if (item) { selectItem(item.id); setCameraPreset("street"); showStage(); }
    }
    if (action.kind === "connect") { selectItem(action.itemId); connectSelected(); }
    if (action.kind === "accept" && life.acceptStory()) { render(); persist(); showToast("约定记下了，接下来慢慢布置就好 ♡"); }
    if (action.kind === "sow" || action.kind === "water") {
      if (action.kind === "sow" ? environment.sow(action.itemId) : environment.water(action.itemId)) {
        state.selectedGardenId = action.itemId;
        refreshGardens(); updateLifeUI(); persist();
        showToast(action.kind === "sow" ? "种子已播下，再浇一点水。" : "水分够了，交给时间慢慢长大。");
      }
    }
    if (action.kind === "resume" && state.paused) document.getElementById("pauseButton").click();
    if (action.kind === "sunny") changeWeather("sunny");
    if (action.kind === "night") { state.minutes = 22 * 60; updateLighting(); updateLifeUI(); persist(); }
    if (action.kind === "follow") { selectResident(action.residentId); startFollowing(); }
    if (action.kind === "season") changeSeason(action.season);
    if (action.kind === "photo") takeRoamPhoto();
    guideUiKey = ""; updateGuideUI();
  }

  function collectMemories() {
    let added = false;
    for (const event of [...life.drainEvents(), ...environment.drainEvents()]) {
      if (state.journal.some((entry) => entry.id === event.id)) continue;
      // A fulfilled wish and its first-use moment belong to one journal entry.
      const earlier = state.journal.find((entry) => entry.kind === event.kind && entry.text === event.text);
      if (earlier && !event.wishId) continue;
      if (earlier) { earlier.id = event.id; earlier.wishId = event.wishId; }
      else state.journal.unshift({ ...event, createdAt: Date.now(), clock: document.getElementById("cityClock").textContent });
      state.journal = state.journal.slice(0, 100);
      added = true;
      showToast(event.kind === "story" ? `♡ 故事有了新的一页 · ${event.title}` : event.wishId ? `♡ 一个心愿实现了 · ${event.title}` : `小城日记添了一页 · ${event.title}`);
    }
    if (added) { updateJournalUI(); persist(); }
  }

  function selectItem(id) {
    state.selectedResidentId = null;
    state.selectedId = id;
    state.activeType = null;
    state.editMode = "select";
    updateActiveCard();
    render();
  }

  function getWorldPoint(event, type = state.activeType, snap = true) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = world.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    if (!snap) return { x: local.x, y: local.y };
    return PalmCityBuilding.snap(local, type);
  }

  function getStagePoint(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function isOnIsland(point) { return PalmCityBuilding.onIsland(point); }
  function createId() { nextId = Math.max(nextId + 1, Date.now(), ...state.items.map((item) => item.id + 1)); return nextId; }

  function addRoadAt(point, shouldSnapshot = false) {
    if (!isOnIsland(point)) return false;
    const existing = state.items.find((item) => item.type === "road" && Math.abs(item.x - point.x) < 4 && Math.abs(item.y - point.y) < 4);
    if (existing) return false;
    if (shouldSnapshot) snapshot("铺路");
    state.items.push({ id: createId(), type: "road", x: point.x, y: point.y, rotate: 0 });
    state.lastEdited = Date.now();
    return true;
  }

  function paintRoadTo(point) {
    let changed = false;
    for (const cursor of PalmCityBuilding.roadStroke(drag.lastPoint || point, point, state.items)) {
      if (addRoadAt(cursor, !drag.snapshotTaken)) { drag.snapshotTaken = true; changed = true; }
    }
    drag.lastPoint = point;
    if (changed) render();
  }

  function placeItem(event) {
    const type = state.activeType;
    const point = getWorldPoint(event, type);
    if (!isOnIsland(point)) { showToast("请把元素放在小岛上"); return; }
    if (type === "road") {
      if (!addRoadAt(point, true)) { hidePlacementPreview(); showToast("这里已经有一条小路，换个落点试试"); return; }
      commitLayout();
      state.selectedId = null;
      state.activeType = null;
      state.editMode = "select";
      updateActiveCard();
      render();
      persist();
      showToast("小路已铺下，选中建筑可以一键接路");
      return;
    }
    snapshot(`放置${catalog[type].label}`);
    const id = createId();
    state.items.push({ id, type, x: point.x, y: point.y, rotate: 0 });
    commitLayout();
    state.selectedId = id;
    state.lastEdited = Date.now();
    state.activeType = null;
    state.editMode = "select";
    updateActiveCard();
    render();
    persist();
    showToast(`${catalog[type].label} 已放置`);
  }

  function deleteSelected() {
    if (state.viewMode || drag) return;
    if (state.selectedId == null) return;
    const removed = state.items.find((item) => item.id === state.selectedId);
    if (!removed) return;
    snapshot(`删除${catalog[removed.type].label}`);
    state.items = state.items.filter((item) => item.id !== state.selectedId);
    commitLayout();
    state.selectedId = null;
    state.editMode = "select";
    state.lastEdited = Date.now();
    render();
    persist();
    if (removed) showToast(`${catalog[removed.type].label} 已移除`);
  }

  function rotateSelected() {
    if (state.viewMode || drag) return;
    if (state.selectedId == null) return;
    const item = state.items.find((candidate) => candidate.id === state.selectedId);
    if (!item) return;
    if (item.type === "road") {
      showToast("小路方向会根据相邻街道自动生成");
      return;
    }
    snapshot(`旋转${catalog[item.type].label}`);
    item.rotate = ((item.rotate || 0) + 90) % 360;
    commitLayout();
    state.lastEdited = Date.now();
    render();
    persist();
    showToast(`${catalog[item.type].label} 已旋转`);
  }

  function copySelected() {
    if (state.viewMode || drag) return;
    if (state.selectedId == null) return;
    const item = state.items.find((candidate) => candidate.id === state.selectedId);
    if (!item) return;
    snapshot(`复制${catalog[item.type].label}`);
    const step = item.type === "road" ? ROAD_STEP : 24;
    let x = item.x + step;
    let y = item.y + step;
    while (state.items.some((candidate) => Math.abs(candidate.x - x) < 8 && Math.abs(candidate.y - y) < 8)) { x += step; y -= step; }
    const copy = { ...item, id: createId(), x, y };
    state.items.push(copy);
    commitLayout();
    state.selectedId = copy.id;
    state.lastEdited = Date.now();
    render();
    persist();
    showToast(`${catalog[item.type].label} 已复制`);
  }

  function runEditAction(action) {
    if (state.viewMode) return;
    if (action === "focus") focusSelected();
    if (action === "connect") connectSelected();
    if (action === "move") {
      if (state.selectedId == null) return;
      state.editMode = "move";
      render();
      showToast("拖动选中的元素移动位置");
    }
    if (action === "rotate") rotateSelected();
    if (action === "copy") copySelected();
    if (action === "delete") deleteSelected();
  }

  function undo() {
    restoreEdit(false);
  }

  function redo() { restoreEdit(true); }

  function restoreEdit(forward) {
    if (state.viewMode || drag) return;
    const before = state.items;
    const entry = forward ? editHistory.redo(state.items) : editHistory.undo(state.items);
    if (!entry) return;
    state.items = entry.items;
    showBuildFeedback(before, state.items);
    state.selectedId = null;
    state.activeType = null;
    state.editMode = "select";
    state.lastEdited = Date.now();
    updateActiveCard();
    render();
    persist();
    showToast(`已${forward ? "重做" : "撤销"}${entry.label}`);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1700);
  }

  function updateRoamUI() {
    const selected = state.items.find(item => item.id === state.selectedId);
    focusSelection.hidden = !selected || state.viewMode;
    focusSelection.title = selected ? `靠近看看${catalog[selected.type].label}` : "选中一个元素，再靠近看看";
    const resident = life.residents.find((person) => person.id === followResidentId);
    document.body.classList.toggle("is-following", !!resident);
    document.getElementById("roamStatus").hidden = !resident;
    if (resident) {
      document.getElementById("roamResidentName").textContent = `跟着${resident.name}走走`;
      document.getElementById("roamResidentActivity").textContent = resident.visible ? life.activity(resident) : "回家歇一会儿，等会儿再出门";
    }
    document.querySelectorAll("[data-camera-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.cameraPreset === cameraPreset)));
    document.getElementById("personalPhotoBadge").textContent = state.photos.length;
    document.getElementById("takeRoamPhoto").disabled = capturingPhoto || !ready || saveBlocked;
    document.querySelector("#takeRoamPhoto span").textContent = capturingPhoto ? "洗印中…" : "拍一张";
  }

  function stopFollowing(save = true) {
    followResidentId = null; cameraTarget = null;
    updateRoamUI();
    if (save) persist();
  }

  function setCameraPreset(preset) {
    if (drag) return;
    if (!Object.keys(PalmCityRoaming.presets).includes(preset)) return;
    let resident = life.residents.find((person) => person.id === (followResidentId || state.selectedResidentId));
    if (preset === "neighbor" && !resident) {
      resident = life.residents[0];
      if (resident) { state.selectedResidentId = resident.id; state.selectedId = null; state.activeType = null; updateActiveCard(); render(); }
    }
    const selected = state.items.find((item) => item.id === state.selectedId);
    const focus = PalmCityRoaming.focusResident(resident) || selected || { x: -state.panX / state.zoom, y: -state.panY / state.zoom };
    if (preset === "overview") { followResidentId = null; cameraTarget = PalmCityRoaming.frame(preset); }
    else cameraTarget = PalmCityRoaming.frame(preset, focus);
    cameraPreset = preset;
    if (state.reducedMotion) { Object.assign(state, cameraTarget); cameraTarget = null; setWorldTransform(); persist(); }
    updateRoamUI();
  }

  function focusSelected() {
    if (drag || state.viewMode) return;
    const item = state.items.find(entry => entry.id === state.selectedId);
    if (!item) return;
    stopFollowing(false);
    cameraPreset = "street";
    cameraTarget = PalmCityRoaming.frame("street", { x: item.x, y: item.y - (item.type === "road" || item.type === "water" ? 0 : 18) });
    // Looking closer never zooms out a detail the player has already chosen.
    cameraTarget.zoom = Math.max(state.zoom, cameraTarget.zoom);
    cameraTarget.panX = -item.x * cameraTarget.zoom;
    cameraTarget.panY = -(item.y - (item.type === "road" || item.type === "water" ? 0 : 18)) * cameraTarget.zoom;
    if (state.reducedMotion) { Object.assign(state, cameraTarget); cameraTarget = null; setWorldTransform(); persist(); }
    updateRoamUI();
  }

  function startFollowing() {
    const resident = life.residents.find((person) => person.id === state.selectedResidentId);
    if (!resident) return;
    closeMobileDrawers();
    setViewMode(true);
    followResidentId = resident.id;
    setCameraPreset("neighbor");
    updateRoamUI();
    document.getElementById("stageCard").scrollIntoView({ block: "center", behavior: state.reducedMotion ? "instant" : "smooth" });
    showToast("跟着邻居慢慢走。拖动画面，就能停在喜欢的地方。");
  }

  function animateCamera(dt) {
    if (!ready || drag || collectionBusy || saveBlocked || document.hidden || document.querySelector("dialog[open]")) return;
    let target = cameraTarget;
    if (followResidentId) {
      const resident = life.residents.find((person) => person.id === followResidentId);
      const focus = PalmCityRoaming.focusResident(resident);
      if (!focus) { stopFollowing(); return; }
      target = PalmCityRoaming.frame(cameraPreset === "overview" ? "neighbor" : cameraPreset, focus);
    }
    if (!target) return;
    const next = PalmCityRoaming.smooth(state, target, dt, state.reducedMotion);
    Object.assign(state, next); setWorldTransform();
    if (!followResidentId && ["zoom", "panX", "panY"].every((key) => Math.abs(state[key] - target[key]) < .02)) {
      Object.assign(state, target); cameraTarget = null; setWorldTransform(); persist();
    }
  }

  function setZoom(nextZoom, anchor) {
    if (drag) return;
    stopFollowing(false); cameraPreset = "custom";
    const oldZoom = state.zoom;
    state.zoom = PalmCityRoaming.clampZoom(nextZoom);
    if (anchor) {
      const point = getWorldPoint({ clientX: anchor.x, clientY: anchor.y }, null, false);
      state.panX += point.x * (oldZoom - state.zoom);
      state.panY += point.y * (oldZoom - state.zoom);
    }
    setWorldTransform();
    updateRoamUI();
    persist();
  }

  function resetView() {
    if (drag) return;
    stopFollowing(false); cameraPreset = "overview";
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    setWorldTransform();
    updateRoamUI();
    persist();
  }

  function updateCursor(event) {
    const rect = stage.getBoundingClientRect();
    const point = getStagePoint(event);
    placementCursor.style.left = `${point.x}px`;
    placementCursor.style.top = `${point.y}px`;
    const worldPoint = getWorldPoint(event, state.activeType);
    coordinateHint.textContent = `${worldPoint.x}, ${worldPoint.y}`;
    placementCursor.querySelector("small").textContent = state.activeType === "house" ? `放下后是${PalmCityDesign.houseStyle({ ...worldPoint, id: -1 }, state.items).label}` : "点击放置";
    if (state.activeType) placementCursor.style.display = "block";
    if (point.x < 0 || point.y < 0 || point.x > rect.width || point.y > rect.height) placementCursor.style.display = "none";
    if (state.activeType && !state.viewMode && !drag) showPlacementPreview(event, { ...worldPoint, type: state.activeType });
  }

  function hidePlacementPreview() {
    placementPreviewKey = "";
    placementPreview.querySelectorAll(".placement-ghost").forEach(node => node.remove());
    placementFeedback.hidden = true;
  }

  function previewMarkup(item) {
    if (item.type === "road") return `<g transform="translate(${item.x} ${item.y})"><path class="road-edge" d="${pathForDirections(roadConnections(item))}"/><path class="road-body" d="${pathForDirections(roadConnections(item))}"/></g>`;
    return renderItem({ ...item, id: item.id ?? -1 }).replace(/ data-item-id="[^"]*"/, "").replace(/\bis-selected\b/, "");
  }

  function showPlacementPreview(event, item, moving = false) {
    if (state.viewMode) return;
    const valid = isOnIsland(item) && !(item.type === "road" && state.items.some(other => other.type === "road" && other.id !== item.id && Math.abs(other.x - item.x) < 4 && Math.abs(other.y - item.y) < 4));
    const status = !isOnIsland(item) ? "请把落点留在小岛上" : !valid ? "这里已经有一条小路" : moving ? "松手安放到这里" : event.pointerType === "touch" ? "松手放置 · 拖动可浏览" : "点击安放到这里";
    const key = [item.id, item.type, item.x, item.y, item.rotate || 0, state.season, moving, valid].join(":");
    if (key !== placementPreviewKey) {
      hidePlacementPreview(); placementPreviewKey = key;
      const origin = moving ? `<ellipse class="placement-origin" cx="${drag.itemX}" cy="${drag.itemY}" rx="40" ry="20"/>` : "";
      placementPreview.insertAdjacentHTML("beforeend", `<g class="placement-ghost ${valid ? "" : "is-invalid"}" data-x="${item.x}" data-y="${item.y}" data-valid="${valid}">${origin}<g class="placement-model">${previewMarkup(item)}</g><g transform="translate(${item.x} ${item.y})"><ellipse class="placement-footprint" rx="${item.type === "water" || item.type === "dock" ? 62 : 42}" ry="23"/><path class="placement-cross" d="M-9 0H9M0-9V9"/></g></g>`);
      placementFeedback.querySelector("svg").innerHTML = previewMarkup({ ...item, x: 0, y: 0 });
      placementFeedback.querySelector("strong").textContent = `${catalog[item.type].label} · ${formatPosition(item)}`;
    }
    const rect = stage.getBoundingClientRect(), point = getStagePoint(event);
    placementFeedback.style.left = `${Math.max(83, Math.min(rect.width - 83, point.x))}px`;
    placementFeedback.style.top = `${Math.max(12, point.y - 126)}px`;
    placementFeedback.classList.toggle("is-invalid", !valid);
    placementFeedback.classList.toggle("is-touch", event.pointerType === "touch");
    placementFeedback.querySelector("small").textContent = status;
    placementFeedback.hidden = false;
  }

  function renderResident(resident) {
    return `<g id="${resident.id}" class="resident" data-resident-id="${resident.id}" role="button" tabindex="0" aria-label="查看${resident.name}的档案">
      <circle class="resident-hit" cy="-12" r="23" fill="transparent" />
      <ellipse class="resident-selection" cy="1" rx="16" ry="7" />
      <ellipse cx="1" cy="2" rx="10" ry="3.5" fill="#34473c" opacity=".2" />
      <g class="resident-figure">
        <g class="resident-legs" stroke="#4b514b" stroke-width="3.5" stroke-linecap="round"><path class="leg-left" d="M-3-6L-4 0"/><path class="leg-right" d="M3-6L4 0"/></g>
        <path d="M-6-16Q0-20 6-16L7-6Q0-3-7-6Z" fill="${resident.color}" stroke="#4b514b" stroke-width=".7" />
        <path class="resident-arm" d="M-5-15L-9-8" fill="none" stroke="#eed2ac" stroke-width="3" stroke-linecap="round"/>
        <circle cy="-23" r="6.5" fill="#eed2ac" />
        <path d="M-6-23Q-8-32 0-31Q8-31 6-23L3-26-2-25Z" fill="#5b4b41" />
        <circle cx="-2" cy="-23" r=".7" fill="#53483d"/><circle cx="2" cy="-23" r=".7" fill="#53483d"/>
        ${resident.id === "cityVisitor" ? "" : PalmCitySeasons.outfit(state.season, resident.slot)}
        <path class="resident-bag" d="M5-15h8l-1 10H6ZM7-15v-2q2-3 4 0v2" fill="#eed9ae" stroke="#997c57" stroke-width="1" />
        <g class="resident-book"><path d="M-10-13L0-11L10-13V-5L0-3L-10-5Z" fill="#e7d8ad" stroke="#788e79" stroke-width="1.1"/><path d="M0-11V-3M-7-10l4 1m6 0l4-1" stroke="#a5a581" stroke-width=".7"/></g>
        <g class="resident-tea"><path d="M-2-15H5L4-10H-1Z" fill="#f9eacc" stroke="#9f8c6b" stroke-width=".7"/><path d="M5-14q5 0 0 3" fill="none" stroke="#bba580" stroke-width="1"/><path class="tea-steam" d="M1-19q-2-2 0-4" fill="none" stroke="#fff8e6" stroke-width="1.2" stroke-linecap="round"/></g>
      </g>
      <g class="resident-umbrella" pointer-events="none"><path d="M5-50V-14q0 5-4 4" fill="none" stroke="#786f5c" stroke-width="1.5"/><path d="M-18-46Q4-76 27-46Q20-50 14-45Q5-51-3-45Q-10-50-18-46Z" fill="${["#cba08b", "#9aaf95", "#d2bc80", "#9aaec0", "#b8a1bb"][resident.slot]}" stroke="#f2e8cc" stroke-width="1.2"/><path d="M5-62Q-5-58-3-45M5-62Q15-58 14-45" fill="none" stroke="#f4ecd1" stroke-width=".9"/></g>
      <g class="resident-bubble" pointer-events="none"><rect x="-49" y="-65" width="98" height="25" rx="9"/><path d="M-4-41L0-35L5-41"/><text y="-49">${["今天风好舒服", "花也在慢慢长大", "慢慢来就好", "又是美好的一天", "该泡杯热茶了"][resident.slot]}</text></g>
      <text class="resident-name" y="17">${resident.name}</text>
    </g>`;
  }

  function renderResidentPositions() {
    for (const resident of life.residents) {
      const node = residentNodes.get(resident.id);
      if (!node) continue;
      const selected = state.selectedResidentId === resident.id;
      const sitting = resident.phase === "resting" && resident.plan?.storyId !== "spring";
      const moment = life.moment(resident);
      const walking = ["outbound", "returning", "rain-walk", "rain-home", "rain-returning"].includes(resident.phase) && moment !== "greeting";
      const next = resident.route?.[resident.step];
      const facing = moment === "greeting" ? resident.greetingSide : next && Math.abs(next.x - resident.x) > 1 ? Math.sign(next.x - resident.x) : 1;
      const stride = walking && !state.reducedMotion ? Math.sin(animationSeconds * 11 + resident.slot) * 2.8 : 0;
      const sway = walking && !state.reducedMotion ? resident.sway.toFixed(2) : 0;
      const wave = state.reducedMotion ? 0 : Math.sin(animationSeconds * 9) * 2;
      const umbrella = environment.weather.kind === "rain" && resident.phase !== "sheltered";
      const speech = life.speech(resident);
      const words = speech || PalmCitySeasons.residentLine(state.season, resident, environment.weather.kind);
      const bubble = speech || selected || (animationSeconds + resident.slot * 7) % 28 > 24 ? "1" : "0";
      const steam = state.reducedMotion ? ".6" : String(.4 + .4 * Math.sin(animationSeconds * 2));
      const key = JSON.stringify(resident.visible ? [resident.x.toFixed(2), resident.y.toFixed(2), resident.phase, sitting, moment, selected, facing, stride, sway, moment === "greeting" ? wave : 0, umbrella, resident.carrying, words, bubble, moment === "tea" ? steam : ""] : [false]);
      if (residentPaintKeys.get(node) === key) continue;
      residentPaintKeys.set(node, key);
      node.setAttribute("transform", `translate(${resident.x.toFixed(2)} ${resident.y.toFixed(2)})`);
      node.style.display = resident.visible ? "" : "none";
      node.dataset.phase = resident.phase;
      node.classList.toggle("is-sitting", sitting);
      node.dataset.moment = moment;
      node.classList.toggle("is-selected", selected);
      node.querySelector(".resident-figure").setAttribute("transform", `translate(0 ${sway}) scale(${facing || 1} 1)`);
      node.querySelector(".leg-left").setAttribute("d", sitting ? "M-3-6L-8-1L-7 4" : `M-3-6L${-4 + stride} 0`);
      node.querySelector(".leg-right").setAttribute("d", sitting ? "M3-6L8-1L8 4" : `M3-6L${4 - stride} 0`);
      node.querySelector(".resident-arm").setAttribute("d", moment === "greeting" ? `M-5-15L-11-20L${-12 + wave}-28` : moment === "tea" ? "M-5-15L-5-10L0-13" : moment === "reading" ? "M-5-15L-9-9" : `M-5-15L${-9 - stride / 2}-8`);
      node.querySelector(".resident-umbrella").style.display = umbrella ? "" : "none";
      node.querySelector(".resident-bubble").setAttribute("transform", umbrella ? "translate(0 -21)" : moment === "greeting" && resident.greetingSide < 0 ? "translate(0 -30)" : "translate(0 0)");
      node.querySelector(".resident-bag").style.opacity = resident.carrying ? "1" : "0";
      node.querySelector(".resident-book").style.display = moment === "reading" ? "inline" : "none";
      node.querySelector(".resident-tea").style.display = moment === "tea" ? "inline" : "none";
      node.querySelector(".tea-steam").style.opacity = steam;
      node.querySelector(".resident-bubble text").textContent = words;
      const bubbleWidth = Math.max(98, Math.min(210, [...words].length * 10 + 18));
      node.querySelector(".resident-bubble rect").setAttribute("x", -bubbleWidth / 2);
      node.querySelector(".resident-bubble rect").setAttribute("width", bubbleWidth);
      node.querySelector(".resident-bubble").style.opacity = bubble;
    }
    renderVisitorPosition();
    const key = life.residents.map(person => `${person.id}:${person.y}:${person.phase === "resting"}`).join("|") + `|${visitors.active?.id}:${visitors.active?.y}:${!!document.getElementById("cityVisitor")}`;
    if (depthPaintKey === key) return;
    depthPaintKey = key;
    const depths = [...sceneryDepths];
    depths.push(...life.residents.map((resident) => ({ y: resident.y + (resident.phase === "resting" ? 2 : 0), node: residentNodes.get(resident.id) })));
    depths.push({ y: visitors.active?.y || 0, node: document.getElementById("cityVisitor") });
    depths.sort((a, b) => a.y - b.y).forEach(({ node }, index) => {
      if (node && itemsLayer.children[index] !== node) itemsLayer.insertBefore(node, itemsLayer.children[index] || null);
    });
  }

  function syncVisitors() {
    visitors.sync(state.items, {
      weather: environment.weather.kind,
      gardens: Object.fromEntries(state.items.filter((item) => item.type === "garden").map((item) => [item.id, environment.garden(item.id)])),
      occupied: life.residents.filter((resident) => ["outbound", "resting"].includes(resident.phase)).map((resident) => resident.plan?.targetId).filter((id) => id != null),
    });
    life.setReservedFacilities(visitors.reservedIds());
  }

  function renderVisitor() {
    return renderResident({ id: "cityVisitor", name: "阿远", color: "#7d9889", slot: 3 })
      .replace('class="resident"', 'class="resident city-visitor"')
      .replace('data-resident-id="cityVisitor"', 'data-visitor-id="ayuan"')
      .replace("查看阿远的档案", "查看来客阿远的行程")
      .replace('<g class="resident-umbrella"', `<g class="visitor-outfit" pointer-events="none"><path d="M-9-29L-5-38Q0-41 6-37L9-29Z" fill="#e4c58d"/><ellipse cy="-29" rx="13" ry="3" fill="#d4b47a"/><path d="M-5-16L6-7M6-16L-5-7" stroke="#4d655d" stroke-width="1.2"/><rect x="-5" y="-13" width="11" height="8" rx="1.5" fill="#f7edd8" stroke="#586e63"/><circle cx=".5" cy="-9" r="2.7" fill="#708779"/></g><circle class="visitor-flash" cx="1" cy="-10" r="15" fill="#fff6cb" pointer-events="none"/><g class="resident-umbrella"`);
  }

  function renderVisitorPosition() {
    const a = visitors.active;
    const node = document.getElementById("cityVisitor");
    if (node) {
      node.style.display = a && !["arriving", "leaving"].includes(a.phase) ? "" : "none";
      if (a) {
        node.dataset.phase = a.phase;
        node.setAttribute("transform", `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`);
        node.setAttribute("aria-label", `阿远 · ${visitors.activity()}`);
        node.classList.toggle("is-sitting", a.phase === "resting");
        const umbrella = environment.weather.kind === "rain" && a.phase !== "sheltered";
        node.querySelector(".resident-umbrella").style.display = umbrella ? "" : "none";
        node.querySelector(".resident-bag").style.display = "none";
        node.querySelector(".resident-bubble").setAttribute("transform", umbrella ? "translate(0 -24)" : "translate(0 -7)");
        node.querySelector(".resident-bubble text").textContent = a.speech;
        node.querySelector(".resident-bubble").style.opacity = a.speechTime > 0 ? "1" : "0";
        node.querySelector(".visitor-flash").style.opacity = a.phase === "photographing" ? state.reducedMotion ? ".15" : String(Math.max(0, Math.sin(animationSeconds * 7)) * .7) : "0";
      }
    }
    const boat = document.getElementById("visitorBoat");
    boat.style.display = a ? "" : "none";
    if (!a) return;
    if (!boat.firstChild) boat.innerHTML = `<g class="little-boat"><ellipse cy="15" rx="43" ry="8" fill="#9abdb1" opacity=".3"/><path d="M-43 1Q0 31 43 1L30 20Q0 33-31 20Z" fill="#8eaa9c" stroke="#6d8e80" stroke-width="1.5"/><path d="M-43 1Q0 17 43 1Q0-10-43 1Z" fill="#d4bb8d" stroke="#eee0ba" stroke-width="2"/><path d="M-24 1H25" stroke="#a58b63" stroke-width="3"/><path d="M14 0V-30" stroke="#786f54" stroke-width="2"/><path d="M15-29L34-4H15Z" fill="#fbefcd"/><g class="boat-passenger"><path d="M-14-8Q-7-14 0-8L2 0H-16Z" fill="#7d9889"/><circle cx="-7" cy="-17" r="6" fill="#e7c5a1"/><path d="M-16-21H2M-12-22L-10-29H-4L-2-22" fill="#e1c18a" stroke="#d4b47a" stroke-width="2.5" stroke-linecap="round"/></g><path d="M-47 18Q-56 20-63 17M37 24Q49 26 58 21" fill="none" stroke="#93b4a9" stroke-width="1.7"/></g>`;
    const progress = a.phase === "arriving" ? 1 - a.boatProgress : a.phase === "leaving" ? a.boatProgress : 0;
    const bob = state.paused || state.reducedMotion ? 0 : Math.sin(animationSeconds * 1.8) * 1.5;
    boat.setAttribute("transform", `translate(${a.boatDock.x - 72 - progress * 108} ${a.boatDock.y + 26 + progress * 145 + bob})`);
    boat.querySelector(".boat-passenger").style.display = ["arriving", "leaving"].includes(a.phase) ? "" : "none";
    boat.dataset.phase = a.phase;
  }

  function updateVisitorUI() {
    const a = visitors.active, prep = visitors.preparation();
    const key = JSON.stringify([a?.phase, a?.task, a?.speech, a?.visited, prep.conditions, state.paused, visitors.count]);
    if (key === visitorUiKey) return;
    visitorUiKey = key;
    document.querySelector(".visitor-panel").dataset.phase = a?.phase || "idle";
    document.getElementById("visitorName").textContent = a ? "来客 · 阿远" : visitors.count ? "再会一面 · 阿远" : "下一位来客 · 阿远";
    document.getElementById("visitorActivity").textContent = visitors.activity();
    document.getElementById("visitorQuote").textContent = `“${a?.speech || (visitors.count ? "上次的风景还记得，想再来看看。" : "想来看看，你种下的那片风景。") }”`;
    const button = document.getElementById("inviteVisitor");
    button.disabled = !!a || !prep.ready;
    button.innerHTML = a ? a.phase === "leaving" ? "挥手告别 ♡" : a.phase === "arriving" ? "小船靠岸中…" : "正在游览 ♡" : `${visitors.count ? "再次邀请" : "邀请来客"} <span>↗</span>`;
    document.getElementById("cancelVisit").hidden = !a || ["arriving", "leaving"].includes(a.phase);
    const hint = document.getElementById("visitorHint");
    hint.textContent = state.paused && a ? "小城已暂停，点「继续」让旅程接着走。" : a?.phase === "waiting" ? `${a.speech} 接好附近道路后会继续，也可以结束这次来访。` : a?.phase === "leaving" ? "阿远留下了一张明信片，去右侧「旅行纪念册」翻看吧。" : a ? "沿路走，慢慢逛。遇雨会撑伞找凉亭，雨停继续今天的行程。" : prep.ready ? "随时可邀请，无需等到明天。花园开花时，阿远还会停下来拍照。" : "先放下小码头，入口与小路对齐并留约一格，再把路接到花园。";
    const stages = !a ? ["idle", "idle", "idle", "idle"] : [a.phase === "arriving" ? "current" : "done", a.visited.garden ? "done" : a.task > 0 ? "skipped" : a.phase === "arriving" ? "idle" : "current", a.visited.rest ? "done" : a.task > 1 ? "skipped" : a.task === 1 ? "current" : "idle", a.phase === "leaving" ? "done" : a.task === 2 ? "current" : "idle"];
    document.querySelectorAll("#visitItinerary li").forEach((item, index) => { item.dataset.state = stages[index]; item.title = stages[index] === "skipped" ? "本次未到访，明信片会如实记录" : ""; });
    const preparation = document.getElementById("visitorPreparation");
    preparation.hidden = !!a;
    preparation.innerHTML = prep.conditions.map((condition) => condition.done ? `<span class="is-ready">✓ ${condition.label}</span>` : `<button type="button" data-place-environment="${condition.type}">＋ ${condition.label}</button>`).join("");
  }

  function updateTravelUI() {
    const key = JSON.stringify([travelExpanded, state.postcards.map((card) => [card.id, !!card.image, !!card.pendingScene])]);
    if (key === travelUiKey) return;
    travelUiKey = key;
    document.getElementById("travelCount").textContent = `${state.postcards.length} 张明信片`;
    document.getElementById("travelMore").hidden = state.postcards.length <= 2;
    document.getElementById("travelMore").textContent = travelExpanded ? "收起明信片 ↑" : `翻开另外 ${state.postcards.length - 2} 张 ↓`;
    document.getElementById("travelList").innerHTML = state.postcards.length ? state.postcards.slice(0, travelExpanded ? 24 : 2).map((card) => `<button type="button" class="travel-card" data-postcard-id="${escapeHtml(card.id)}" ${card.image ? "" : "disabled"} aria-label="翻看${escapeHtml(card.title)}：${escapeHtml(card.cityName)}"><span class="travel-picture">${card.image ? `<img src="${card.image}" alt="${escapeHtml(card.cityName)} · 阿远离开时的风景" loading="lazy"/>` : '<span class="travel-processing">正在装好这一城风景…</span>'}<span class="travel-postmark">${String(card.number).padStart(2, "0")}<small>来访留念</small></span></span><span class="travel-card-copy"><strong>${escapeHtml(card.title)}</strong><span>阿远寄自 · ${escapeHtml(card.cityName)}</span><q>${escapeHtml(card.quote)}</q><small>${new Date(card.createdAt).toLocaleDateString("zh-CN")} <b>翻看 / 保存 ↗</b></small></span></button>`).join("") : `<div class="travel-empty"><span aria-hidden="true">▱</span><strong>第一张明信片，正在路上</strong><p>邀请阿远逛逛小城。等他乘船离开，一张当日风景就会寄到这里。</p></div>`;
  }

  function collectVisitorEvents() {
    for (const event of visitors.drainEvents()) {
      if (event.kind === "cancelled") { showToast("这次来访已结束，接好道路后再相见。"); persist(); }
      if (event.kind === "departed") { updateVisitorUI(); persist(); }
      if (event.kind !== "postcard" || state.postcards.some((card) => card.id === event.id)) continue;
      renderVisitorPosition();
      const visits = [event.visited.garden ? "沿着小路逛了花园" : "在小城走了走", event.visited.photo ? "拍下花开的样子" : "", event.visited.rest ? "坐在树下听风" : "", event.rainSeen ? "还遇见一场小雨" : ""].filter(Boolean);
      const card = { id: event.id, number: event.number, name: "阿远", title: event.number === 1 ? "第一次来访" : `第 ${event.number} 次来访`, cityName: state.cityName, season: state.season, quote: event.quote, text: `阿远${visits.join("，")}。`, createdAt: Date.now(), clock: document.getElementById("cityClock").textContent, weather: environment.weather.kind, image: null, pendingScene: freezePostcardScene() };
      state.postcards.unshift(card);
      state.postcards = state.postcards.slice(0, 24);
      updateTravelUI();
      writeState();
      finishPostcard(card);
      showToast("阿远寄来一张明信片，已收进旅行纪念册 ♡");
    }
  }

  function selectResident(id) {
    if (!life.residents.some((resident) => resident.id === id)) return;
    if (followResidentId && followResidentId !== id) stopFollowing(false);
    state.selectedResidentId = id;
    state.selectedId = null;
    state.activeType = null;
    updateActiveCard();
    render();
    closeMobileDrawers();
    if (window.matchMedia("(max-width: 760px)").matches) stage.scrollIntoView({ block: "center", behavior: state.reducedMotion ? "instant" : "smooth" });
  }

  function updateLifeUI() {
    updateRoamUI();
    updateWishesUI();
    updateStoriesUI();
    updateGuideUI();
    updateJournalUI();
    const people = life.residents;
    const signature = people.map((resident) => resident.id).join("|");
    if (signature !== rosterKey || !document.getElementById("residentList").children.length) {
      rosterKey = signature;
      document.getElementById("residentList").innerHTML = people.map((resident) => `<button class="resident-row" type="button" data-resident-select="${resident.id}" aria-label="查看${resident.name}的档案"><span class="resident-avatar" style="--resident-color:${resident.color}" aria-hidden="true"></span><span class="resident-row-copy"><strong>${resident.name}</strong><small></small></span><span class="resident-row-arrow">↗</span></button>`).join("");
    }
    for (const resident of people) {
      const row = document.querySelector(`#residentList [data-resident-select="${resident.id}"]`);
      row.querySelector("small").textContent = life.activity(resident);
      row.classList.toggle("is-selected", state.selectedResidentId === resident.id);
      row.setAttribute("aria-pressed", String(state.selectedResidentId === resident.id));
    }
    document.getElementById("residentCount").textContent = people.length;
    document.getElementById("residentEmpty").hidden = people.length > 0;
    const out = people.filter((resident) => resident.visible).length;
    const connected = people.filter((resident) => resident.plan).length;
    const hint = state.paused ? "时间停在了这一刻。" : !people.length ? "放下一间小屋，等一位邻居。" : environment.weather.kind === "rain" ? `${people.length} 位邻居 · ${people.filter((resident) => resident.phase === "sheltered").length ? "有人在凉亭里听雨" : out ? "撑伞，慢慢去避雨" : "在家听雨，花园慢慢长大"}` : !connected ? "把小屋与商店用小路连起来吧。" : `${people.length} 位邻居 · ${out ? `${out} 位正在外面走走` : "在家小憩，等会儿再出门"}`;
    document.getElementById("lifeStatus").textContent = hint;
    document.getElementById("sceneLifeHint").textContent = hint;
    document.getElementById("sceneCityName").textContent = state.cityName;
    const selected = people.find((resident) => resident.id === state.selectedResidentId);
    document.getElementById("residentPopover").hidden = !selected;
    if (selected) {
      document.getElementById("residentDetailName").textContent = selected.name;
      document.getElementById("residentHobby").textContent = selected.hobby;
      document.getElementById("residentActivity").textContent = life.activity(selected);
      document.getElementById("residentThought").textContent = `“${life.speech(selected) || PalmCitySeasons.residentLine(state.season, selected, environment.weather.kind)}”`;
      document.getElementById("residentAvatar").style.setProperty("--resident-color", selected.color);
    }
  }

  const lightStops = [
    { hour: 0, sky: ["#263844", "#465962"], land: ["#657767", "#536853"], side: ["#4b6257", "#354d45"], window: "#ffe2a0", glow: .6 },
    { hour: 6, sky: ["#596574", "#c79c8e"], land: ["#9caa83", "#8d9974"], side: ["#78876b", "#5c715c"], window: "#f8d89a", glow: .2 },
    { hour: 8, sky: ["#f8f0df", "#e9ead3"], land: ["#e6e0b6", "#c8c68f"], side: ["#b5b780", "#8b986a"], window: "#a7c6c2", glow: 0 },
    { hour: 16, sky: ["#f8f0df", "#e9ead3"], land: ["#e6e0b6", "#c8c68f"], side: ["#b5b780", "#8b986a"], window: "#b2cdca", glow: 0 },
    { hour: 18, sky: ["#eac6ae", "#e6bd9b"], land: ["#d8c593", "#b5b17e"], side: ["#aaa078", "#887c61"], window: "#ffe2a0", glow: .3 },
    { hour: 20, sky: ["#263844", "#465962"], land: ["#657767", "#536853"], side: ["#4b6257", "#354d45"], window: "#ffe2a0", glow: .6 },
    { hour: 24, sky: ["#263844", "#465962"], land: ["#657767", "#536853"], side: ["#4b6257", "#354d45"], window: "#ffe2a0", glow: .6 },
  ];
  function mixColor(a, b, progress) {
    const channels = (color) => color.startsWith("#") ? [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)) : color.match(/\d+/g).map(Number);
    const first = channels(a), second = channels(b);
    const values = first.map((value, index) => Math.round(value * (1 - progress) + second[index] * progress));
    return `rgb(${values.join(",")})`;
  }

  function updateLighting() {
    const hour = state.minutes / 60;
    const end = lightStops.findIndex((stop) => stop.hour > hour);
    const a = lightStops[Math.max(0, end - 1)], b = lightStops[end];
    const progress = (hour - a.hour) / (b.hour - a.hour);
    const raining = environment.weather.kind === "rain";
    const dark = hour >= 20 || hour < 7;
    const rainColors = dark ? { sky: ["#213643", "#3a5059"], land: ["#5a7363", "#48614f"], side: ["#496354", "#344e43"] } : { sky: ["#607d87", "#9bacaa"], land: ["#91a185", "#809273"], side: ["#6d8674", "#567461"] };
    const sceneColor = (key, index) => {
      const color = PalmCitySeasons.tint(mixColor(a[key][index], b[key][index], progress), key, index, state.season, hour);
      return raining ? mixColor(color, rainColors[key][index], key === "sky" ? .57 : .35) : color;
    };
    for (const [id, key] of [["skyGradient", "sky"], ["islandGradient", "land"], ["islandSideGradient", "side"]]) {
      document.querySelectorAll(`#${id} stop`).forEach((stop, index) => stop.setAttribute("stop-color", sceneColor(key, index)));
    }
    const glow = a.glow * (1 - progress) + b.glow * progress;
    const period = hour >= 7 && hour < 16.5 ? "day" : hour >= 16.5 && hour < 20 ? "dusk" : "night";
    life.setNight(period === "night");
    svg.style.setProperty("--window-light", raining && period !== "day" ? "#ffe2a0" : mixColor(a.window, b.window, progress));
    svg.style.setProperty("--sky-top", sceneColor("sky", 0));
    svg.style.setProperty("--sky-bottom", sceneColor("sky", 1));
    svg.style.setProperty("--window-glow", raining ? Math.min(.85, glow + .15) : glow);
    svg.style.setProperty("--lamp-glow", Math.min(1, glow * 1.8 + (raining ? .25 : 0)));
    svg.style.setProperty("--scene-label", period === "night" ? "#dee1cb" : "#6d7967");
    svg.style.setProperty("--season-snow", mixColor("#f2f6ef", "#9fb4b7", Math.min(1, glow * 1.5)));
    document.getElementById("stageCard").dataset.period = period;
    document.getElementById("sceneSun").setAttribute("opacity", period === "night" ? "0" : raining ? ".1" : ".6");
    document.getElementById("sceneMoon").setAttribute("opacity", String(glow * (raining ? .4 : 1)));
    document.getElementById("sceneStars").setAttribute("opacity", String(Math.max(0, (glow - .25) * (raining ? .3 : 2.6))));
    document.getElementById("cityClock").textContent = `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor(state.minutes % 60)).padStart(2, "0")}`;
    document.getElementById("periodLabel").textContent = state.paused ? "时间暂停 · 留住这一刻" : raining ? ({ day: "白天 · 雨落花园", dusk: "黄昏 · 屋檐听雨", night: "雨夜 · 灯火可亲" })[period] : ({ day: "白天 · 微风正好", dusk: "黄昏 · 晚风有信", night: "夜晚 · 灯火可亲" })[period];
    document.getElementById("weatherSymbol").textContent = raining ? "☂" : ({ day: "☀", dusk: "◒", night: "☾" })[period];
    document.getElementById("dayProgress").style.width = `${state.minutes / 1440 * 100}%`;
    document.querySelectorAll("[data-period]").forEach((button) => { if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", String(button.dataset.period === period)); });
    document.getElementById("pauseButton").innerHTML = state.paused ? "▷ <span>继续</span>" : "Ⅱ <span>暂停</span>";
    document.getElementById("pauseButton").setAttribute("aria-pressed", String(state.paused));
    document.getElementById("pauseButton").setAttribute("aria-label", state.paused ? "继续小城时间" : "暂停小城时间");
  }

  function setViewMode(enabled) {
    cancelBuildGesture();
    if (!enabled) stopFollowing(false);
    state.viewMode = enabled;
    state.selectedId = null;
    state.activeType = null;
    state.editMode = "select";
    document.body.classList.toggle("is-viewing", enabled);
    document.getElementById("modeLabel").textContent = enabled ? "正在观赏" : "正在建造";
    document.getElementById("viewButton").innerHTML = `<span aria-hidden="true">${enabled ? "↩" : "◉"}</span> <span class="button-label">${enabled ? "返回建造" : "观赏小城"}</span>`;
    document.getElementById("viewButton").setAttribute("aria-label", enabled ? "返回建造" : "观赏小城");
    document.getElementById("viewButton").title = enabled ? "返回建造" : "观赏小城";
    document.getElementById("viewButton").setAttribute("aria-pressed", String(enabled));
    updateActiveCard();
    render();
  }

  function animate(timestamp) {
    const dt = lastFrame === null ? 0 : Math.max(0, Math.min((timestamp - lastFrame) / 1000, .1));
    lastFrame = timestamp;
    if (!state.paused && !document.hidden && !collectionBusy && !saveBlocked && !document.getElementById("collectionDialog").open) {
      const change = environment.tick(dt);
      if (change.weatherChanged) {
        life.setWeather(environment.weather.kind);
        updateWeatherUI(); updateLighting(); persist();
      }
      if (change.stageChanged) { refreshGardens(); persist(); }
      syncStoryContext();
      life.tick(dt);
      syncVisitors();
      visitors.tick(dt);
      life.setReservedFacilities(visitors.reservedIds());
      collectVisitorEvents();
      collectMemories();
      animationSeconds += dt;
      state.minutes = (state.minutes + dt * 4) % 1440;
      clockSaveElapsed += dt;
    }
    uiElapsed += dt;
    renderResidentPositions();
    animateCamera(dt);
    if (uiElapsed >= .35) { updateLifeUI(); updateLighting(); updateWeatherUI(); updateGardenUI(); updateVisitorUI(); uiElapsed = 0; }
    if (clockSaveElapsed >= 15) { writeState(); clockSaveElapsed = 0; }
    requestAnimationFrame(animate);
  }

  function freezePostcardScene() {
    const clone = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
    const properties = ["fill", "fill-opacity", "stop-color", "stop-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "filter", "visibility", "display", "transform", "transform-origin", "transform-box"];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of properties) copies[index].style.setProperty(property, computed.getPropertyValue(property).replace(/url\(["']?[^)#]*#([^)'" ]+)["']?\)/g, "url(#$1)"));
    });
    clone.querySelectorAll("#gridLines, .selection-ring, .resident-selection, .resident-bubble, .item-label, .resident-name, .visitor-flash, .connection-preview, #placementPreview, #buildEffects").forEach((element) => element.remove());
    clone.querySelector(".sky-fill").style.opacity = "1";
    const sceneWorld = clone.querySelector("#world");
    sceneWorld.removeAttribute("transform");
    sceneWorld.style.transform = "none";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1600"); clone.setAttribute("height", "744");
    clone.setAttribute("viewBox", "-620 -310 1240 580");
    clone.style.position = "static";
    return new XMLSerializer().serializeToString(clone);
  }

  function finishPostcard(card) {
    const task = developPostcard(card);
    captureTasks.add(task);
    task.finally(() => captureTasks.delete(task));
    return task;
  }

  async function developPostcard(card) {
    if (!card.pendingScene || card.image || pendingCaptures.has(card.id)) return;
    pendingCaptures.add(card.id);
    const source = card.pendingScene;
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const sceneImage = new Image();
      await new Promise((resolve, reject) => { sceneImage.onload = resolve; sceneImage.onerror = reject; sceneImage.src = url; });
      const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 960;
      const context = canvas.getContext("2d");
      context.fillStyle = "#f5efdf"; context.fillRect(0, 0, 1600, 960);
      context.drawImage(sceneImage, 0, 0, 1600, 744);
      context.fillStyle = "#fbf5e7"; context.fillRect(0, 744, 1600, 216);
      context.fillStyle = "#4f684f";
      context.font = '700 28px "Microsoft YaHei", sans-serif'; context.fillText(card.cityName, 55, 65);
      context.font = '14px "Microsoft YaHei", sans-serif'; context.fillText(`一张来自小城的明信片 · ${card.clock}${PalmCitySeasons.label(card.season) ? ` · ${PalmCitySeasons.label(card.season)}` : ""} · ${card.weather === "rain" ? "小雨" : "晴天"}`, 57, 95);
      context.fillStyle = "#ad795d"; context.fillRect(55, 780, 3, 126);
      context.font = '12px "Microsoft YaHei", sans-serif'; context.fillText(`TRAVEL NOTES  /  ${new Date(card.createdAt).toLocaleDateString("zh-CN")} · 阿远`, 80, 785);
      context.fillStyle = "#4f684f"; context.font = '700 26px "Microsoft YaHei", sans-serif'; context.fillText(card.title, 80, 824);
      context.font = '17px "Microsoft YaHei", sans-serif'; context.fillText(card.text, 80, 858, 1270);
      context.fillStyle = "#828f78"; context.font = '18px "Microsoft YaHei", sans-serif'; context.fillText(`“${card.quote}”`, 80, 899, 1240);
      context.save(); context.translate(1460, 833); context.rotate(-.12);
      context.strokeStyle = "#b38468"; context.lineWidth = 2; context.setLineDash([3, 4]); context.strokeRect(-44, -44, 88, 88);
      context.setLineDash([]); context.beginPath(); context.arc(0, 0, 32, 0, Math.PI * 2); context.stroke();
      context.fillStyle = "#b38468"; context.textAlign = "center"; context.font = '700 22px "Microsoft YaHei", sans-serif'; context.fillText(String(card.number).padStart(2, "0"), 0, 1);
      context.font = '10px "Microsoft YaHei", sans-serif'; context.fillText("来访留念", 0, 18); context.restore();
      context.textAlign = "right"; context.font = '11px "Microsoft YaHei", sans-serif'; context.fillText("PALM-SIZED WORLD · 14", 1545, 927);
      const compact = document.createElement("canvas"); compact.width = 1000; compact.height = 600;
      compact.getContext("2d").drawImage(canvas, 0, 0, 1000, 600);
      let quality = .82, image = compact.toDataURL("image/jpeg", quality);
      while (image.length > 70000 && quality > .35) { quality -= .12; image = compact.toDataURL("image/jpeg", quality); }
      if (image.length > 70000) {
        compact.width = 800; compact.height = 480;
        compact.getContext("2d").drawImage(canvas, 0, 0, 800, 480);
        image = compact.toDataURL("image/jpeg", .45);
      }
      const saved = state.postcards.find((entry) => entry.id === card.id);
      if (saved && !saved.image && saved.pendingScene === source) { saved.image = image; saved.pendingScene = null; updateTravelUI(); writeState(); }
    } catch (error) { console.error("Unable to develop postcard", error); showToast("明信片已记下，画面会在刷新后重试。"); }
    finally { URL.revokeObjectURL(url); pendingCaptures.delete(card.id); }
  }

  async function openPostcard(card) {
    if (!card?.image) return;
    try {
      const savedImage = new Image();
      await new Promise((resolve, reject) => { savedImage.onload = resolve; savedImage.onerror = reject; savedImage.src = card.image; });
      const canvas = document.createElement("canvas"); canvas.width = savedImage.naturalWidth; canvas.height = savedImage.naturalHeight;
      canvas.getContext("2d").drawImage(savedImage, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Unable to encode postcard");
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      document.getElementById("photoPreview").src = photoUrl;
      document.getElementById("photoPreview").alt = `${card.cityName} · ${card.title}的历史风景`;
      document.getElementById("photoTitle").textContent = `${card.title} · 阿远寄来的风景`;
      document.getElementById("photoDescription").textContent = `${canvas.width} × ${canvas.height} · ${new Date(card.createdAt).toLocaleDateString("zh-CN")}${PalmCitySeasons.label(card.season) ? ` · ${PalmCitySeasons.label(card.season)}` : ""} · 已保存当日景色`;
      const link = document.getElementById("savePhoto");
      link.download = `掌心小城-${card.title}-${card.cityName.replace(/[\\/:*?"<>|]/g, "_")}.png`; link.href = photoUrl;
      if (!document.getElementById("photoDialog").open) document.getElementById("photoDialog").showModal();
    } catch (error) { console.error(error); showToast("明信片暂时未能打开，请再试一次。"); }
  }

  function exportPng(memory = null) {
    if (memory instanceof Event) memory = null;
    const clone = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    const properties = ["fill", "fill-opacity", "stop-color", "stop-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "filter", "visibility", "display", "transform", "transform-origin", "transform-box"];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of properties) {
        const value = computed.getPropertyValue(property).replace(/url\(["']?[^)#]*#([^)'" ]+)["']?\)/g, "url(#$1)");
        copies[index].style.setProperty(property, value);
      }
    });
    clone.querySelectorAll("#gridLines, .selection-ring, .resident-selection, .resident-bubble, .item-label, .resident-name, .visitor-flash, .connection-preview, #placementPreview, #buildEffects").forEach((element) => element.remove());
    clone.querySelector(".sky-fill").style.opacity = "1";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1600");
    clone.setAttribute("height", memory ? "744" : "960");
    clone.setAttribute("viewBox", memory ? "-620 -310 1240 580" : "-620 -370 1240 740");
    clone.style.position = "static";
    const name = state.cityName;
    const clock = document.getElementById("cityClock").textContent;
    const seasonLabel = PalmCitySeasons.label(state.season), capturedWeather = environment.weather.kind;
    const captionColor = svg.style.getPropertyValue("--scene-label") || "#526855";
    const background = document.querySelector("#skyGradient stop").getAttribute("stop-color");
    const imageUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 960;
        const context = canvas.getContext("2d");
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, memory ? 744 : canvas.height);
        context.fillStyle = captionColor;
        context.font = '700 28px "Microsoft YaHei", sans-serif';
        context.fillText(name, 55, 75);
        context.font = '15px "Microsoft YaHei", sans-serif';
        context.fillText(`掌心小城 · 邻居的四季小故事  /  ${clock} · ${seasonLabel} · ${capturedWeather === "rain" ? "小雨" : "晴天"}`, 57, 106);
        if (memory) {
          context.fillStyle = "#fbf5e7";
          context.fillRect(0, 744, 1600, 216);
          context.fillStyle = "#a7ad8b";
          context.fillRect(55, 778, 3, 122);
          context.fillStyle = "#8f9a7e";
          context.font = '13px "Microsoft YaHei", sans-serif';
          context.fillText(`小城日记  /  ${new Date(memory.createdAt).toLocaleDateString("zh-CN")} · ${memory.clock}`, 80, 786);
          context.fillStyle = "#4f684d";
          context.font = '700 25px "Microsoft YaHei", sans-serif';
          context.fillText(memory.title, 80, 825);
          context.font = '18px "Microsoft YaHei", sans-serif';
          context.fillText(memory.text, 80, 862);
          context.fillStyle = "#8b957a";
          context.font = '15px "Microsoft YaHei", sans-serif';
          context.fillText(`“${memory.quote}”`, 80, 896);
          context.textAlign = "right";
          context.font = '12px "Microsoft YaHei", sans-serif';
          context.fillText("PALM-SIZED WORLD · 14", 1545, 906);
          context.textAlign = "left";
        }
        canvas.toBlob((blob) => {
          if (!blob) { showToast("截图导出失败，请再试一次"); return; }
          if (photoUrl) URL.revokeObjectURL(photoUrl);
          photoUrl = URL.createObjectURL(blob);
          document.getElementById("photoPreview").src = photoUrl;
          document.getElementById("photoPreview").alt = memory ? "此刻小城与这篇日记组成的纪念卡" : "当前小城的截图预览";
          document.getElementById("photoTitle").textContent = memory ? "把这个小美好，寄给未来" : "留住这一刻的小城";
          document.getElementById("photoDescription").textContent = memory ? "1600 × 960 · 此刻小城 + 这篇日记" : "1600 × 960 · 包含居民与当前光线";
          const link = document.getElementById("savePhoto");
          link.download = `掌心小城-${memory ? "纪念卡-" : ""}${name.replace(/[\\/:*?"<>|]/g, "_")}.png`;
          link.href = photoUrl;
          document.getElementById("photoDialog").showModal();
        }, "image/png");
      } catch (error) { showToast("截图导出失败，请再试一次"); console.error(error); }
      finally { URL.revokeObjectURL(imageUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); showToast("截图导出失败，请再试一次"); };
    image.src = imageUrl;
  }

  function photoMeta(photo) {
    return `${new Date(photo.createdAt).toLocaleDateString("zh-CN")} · ${photo.clock}${PalmCitySeasons.label(photo.season) ? ` · ${PalmCitySeasons.label(photo.season)}` : ""} · ${photo.weather === "rain" ? "小雨" : "晴天"} · ${PalmCityRoaming.presets[photo.preset]?.label || "自由取景"}${photo.followedName ? ` · 和${photo.followedName}走走` : ""}`;
  }

  function updatePersonalAlbum() {
    const key = JSON.stringify([currentCity?.id, state.cityName, state.photos.map((photo) => [photo.id, photo.note]), deletedPhoto?.photo.id]);
    if (albumUiKey === key) return;
    albumUiKey = key;
    document.getElementById("personalAlbumCount").textContent = `${state.photos.length} 张随手拍`;
    document.getElementById("personalPhotoBadge").textContent = state.photos.length;
    document.getElementById("albumSubtitle").textContent = `${state.cityName} · 走过的街角，记得的日常。`;
    document.getElementById("albumCapacity").textContent = `${state.photos.length} / ${PalmCityRoaming.PHOTO_LIMIT} 张`;
    document.getElementById("albumUndoNotice").hidden = !deletedPhoto || deletedPhoto.cityId !== currentCity?.id;
    const card = (photo, small = false) => `<button type="button" class="${small ? "personal-photo-thumb" : "personal-photo-card"}" data-personal-photo="${escapeHtml(photo.id)}" aria-label="翻看照片：${escapeHtml(photo.note || photo.cityName)}"><span class="personal-photo-image"><img src="${photo.image}" alt="${escapeHtml(photo.cityName)} · ${photo.clock}的风景" loading="lazy"/></span><span class="personal-photo-copy"><strong>${escapeHtml(photo.note || (photo.followedName ? `和${photo.followedName}走过这一角` : "把这一刻，留给以后"))}</strong>${small ? "" : `<small>${escapeHtml(photoMeta(photo))}</small>`}</span></button>`;
    document.getElementById("personalAlbumPreview").innerHTML = state.photos.length ? state.photos.slice(0, 2).map((photo) => card(photo, true)).join("") : '<span class="album-preview-empty">◎<small>还没有收下的风景<br/>从「拍一张」开始吧。</small></span>';
    document.getElementById("personalPhotoGrid").innerHTML = state.photos.length ? state.photos.map((photo) => card(photo)).join("") : '<div class="personal-album-empty"><span aria-hidden="true">▧</span><h3>第一张风景，还在路上</h3><p>跟着邻居散散步，或停在喜欢的街角。<br/>拍一张照片，写一句只属于今天的话。</p><button type="button" data-album-start>回到小城拍一张 ↗</button></div>';
  }

  function openPersonalAlbum() {
    if (!ready) return;
    closeMobileDrawers(); updatePersonalAlbum();
    if (!document.getElementById("albumDialog").open) document.getElementById("albumDialog").showModal();
  }

  function openPersonalPhoto(photo) {
    if (!photo) return;
    photoDraft = { ...photo }; photoDraftCityId = currentCity.id;
    document.getElementById("albumDialog").close();
    const saved = state.photos.some((entry) => entry.id === photo.id);
    document.getElementById("roamPhotoTitle").textContent = saved ? "再翻到这一天" : "把这一刻，留给以后";
    document.getElementById("roamPhotoImage").src = photo.image;
    document.getElementById("roamPhotoImage").alt = `${photo.cityName} · ${photo.clock}拍下的风景`;
    document.getElementById("roamPhotoCity").textContent = photo.cityName;
    document.getElementById("roamPhotoMeta").textContent = photoMeta(photo);
    document.getElementById("roamPhotoNote").value = photo.note;
    document.getElementById("roamPhotoNoteCount").textContent = `${photo.note.length} / 80`;
    document.getElementById("savePersonalPhoto").textContent = saved ? "保存留言 ♡" : "收进相册 ♡";
    document.getElementById("savePersonalPhoto").disabled = false;
    document.getElementById("deletePersonalPhoto").hidden = !saved;
    document.getElementById("roamPhotoError").hidden = true;
    if (!document.getElementById("roamPhotoDialog").open) document.getElementById("roamPhotoDialog").showModal();
  }

  function captureRoamView() {
    const bounds = svg.getBoundingClientRect(), inverse = svg.getScreenCTM().inverse();
    const top = new DOMPoint(bounds.left, bounds.top).matrixTransform(inverse);
    const bottom = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(inverse);
    const clone = svg.cloneNode(true), originals = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
    const properties = ["fill", "fill-opacity", "stop-color", "stop-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "filter", "visibility", "display", "transform", "transform-origin", "transform-box", "d"];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of properties) copies[index].style.setProperty(property, computed.getPropertyValue(property).replace(/url\(["']?[^)#]*#([^)'" ]+)["']?\)/g, "url(#$1)"));
    });
    clone.querySelectorAll("#gridLines, .selection-ring, .resident-selection, .resident-bubble, .item-label, .resident-name, .visitor-flash, .connection-preview, #placementPreview, #buildEffects").forEach((element) => element.remove());
    const width = bottom.x - top.x, height = bottom.y - top.y;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", `${top.x} ${top.y} ${width} ${height}`);
    clone.style.position = "static";
    const sky = clone.querySelector(".sky-fill");
    sky.style.opacity = "1";
    for (const [name, value] of Object.entries({ x: top.x, y: top.y, width, height })) sky.setAttribute(name, value);
    const scale = 1200 / Math.max(bounds.width, bounds.height);
    let outputWidth = Math.max(64, Math.round(bounds.width * scale)), outputHeight = Math.max(64, Math.round(bounds.height * scale));
    clone.setAttribute("width", outputWidth); clone.setAttribute("height", outputHeight);
    const source = new XMLSerializer().serializeToString(clone);
    const background = document.querySelector("#skyGradient stop").getAttribute("stop-color");
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let data;
          for (let attempt = 0; attempt < 6; attempt++) {
            canvas.width = outputWidth; canvas.height = outputHeight;
            const context = canvas.getContext("2d"); context.fillStyle = background; context.fillRect(0, 0, outputWidth, outputHeight);
            context.drawImage(image, 0, 0, outputWidth, outputHeight);
            data = canvas.toDataURL("image/jpeg", Math.max(.45, .86 - attempt * .1));
            if (data.length <= PalmCityRoaming.IMAGE_LIMIT) break;
            outputWidth = Math.max(64, Math.round(outputWidth * .85)); outputHeight = Math.max(64, Math.round(outputHeight * .85));
          }
          if (data.length > PalmCityRoaming.IMAGE_LIMIT) throw new Error("这张照片还没洗印好，请换个取景再试一次。");
          resolve({ image: data, width: canvas.width, height: canvas.height });
        } catch (error) { reject(error); }
        finally { URL.revokeObjectURL(url); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("照片暂时没能洗印，请再拍一次。")); };
      image.src = url;
    });
  }

  function takeRoamPhoto() {
    if (!ready || capturingPhoto || saveBlocked || collectionBusy) return;
    if (state.photos.length >= PalmCityRoaming.PHOTO_LIMIT) { showToast("相册已收满 20 张风景，先移出一张，再拍新的吧。"); openPersonalAlbum(); return; }
    document.getElementById("albumDialog").close();
    const cityId = currentCity.id;
    const metadata = { cityName: state.cityName, season: state.season, minutes: state.minutes, weather: environment.weather.kind, preset: cameraPreset, followedName: life.residents.find((person) => person.id === followResidentId)?.name || "", createdAt: Date.now() };
    capturingPhoto = true; updateRoamUI();
    const task = (async () => {
      try {
        const view = await captureRoamView();
        if (currentCity?.id !== cityId || collectionBusy) return;
        openPersonalPhoto(PalmCityRoaming.makePhoto({ ...metadata, ...view }));
      } catch (error) { showToast(error.message || "照片暂时没能洗印，请再试一次。"); }
      finally { capturingPhoto = false; updateRoamUI(); }
    })();
    captureTasks.add(task); task.finally(() => captureTasks.delete(task));
  }

  async function savePersonalPhoto(event) {
    event.preventDefault();
    const button = document.getElementById("savePersonalPhoto");
    if (button.disabled || !photoDraft || photoDraftCityId !== currentCity.id) return;
    const index = state.photos.findIndex((photo) => photo.id === photoDraft.id);
    if (index < 0 && state.photos.length >= PalmCityRoaming.PHOTO_LIMIT) {
      document.getElementById("roamPhotoError").textContent = "相册已满，请先移出一张照片。"; document.getElementById("roamPhotoError").hidden = false; return;
    }
    button.disabled = true;
    const photo = { ...photoDraft, note: document.getElementById("roamPhotoNote").value.trim().slice(0, 80) };
    if (index < 0) state.photos.unshift(photo); else state.photos[index] = photo;
    updatePersonalAlbum(); updateRoamUI();
    const saved = await writeState();
    document.getElementById("roamPhotoDialog").close();
    showToast(saved ? index < 0 ? "这一刻，已收进这座小城的相册 ♡" : "留言已保存，画面还是当时的模样。" : "照片保留在本页，请通过上方提示保留副本或导出备份。");
  }

  function deletePersonalPhoto() {
    if (!photoDraft || photoDraftCityId !== currentCity.id) return;
    const index = state.photos.findIndex((photo) => photo.id === photoDraft.id);
    if (index < 0) return;
    deletedPhoto = { cityId: currentCity.id, photo: state.photos[index], index };
    state.photos.splice(index, 1);
    document.getElementById("roamPhotoDialog").close();
    updatePersonalAlbum(); updateRoamUI(); persist(); openPersonalAlbum();
  }

  function undoDeletePhoto() {
    if (!deletedPhoto || deletedPhoto.cityId !== currentCity.id) return;
    if (state.photos.length >= PalmCityRoaming.PHOTO_LIMIT) { showToast("相册已满，先移出一张再恢复。"); return; }
    state.photos.splice(Math.min(deletedPhoto.index, state.photos.length), 0, deletedPhoto.photo);
    deletedPhoto = null; updatePersonalAlbum(); updateRoamUI(); persist();
  }

  async function downloadPersonalPhoto() {
    if (!photoDraft || photoDraftCityId !== currentCity.id) return;
    const photo = { ...photoDraft, note: document.getElementById("roamPhotoNote").value.trim().slice(0, 80) };
    const button = document.getElementById("downloadPersonalPhoto"); button.disabled = true;
    try {
      const image = new Image(); image.src = photo.image; await image.decode();
      const scale = photo.width / 1200, footer = Math.round(170 * scale);
      const canvas = document.createElement("canvas"); canvas.width = photo.width; canvas.height = photo.height + footer;
      const context = canvas.getContext("2d"); context.fillStyle = "#fbf6e8"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, photo.width, photo.height);
      const left = 40 * scale;
      context.fillStyle = "#64785b"; context.font = `600 ${24 * scale}px "Microsoft YaHei", sans-serif`;
      context.fillText(photo.cityName, left, photo.height + 38 * scale);
      context.fillStyle = "#96a087"; context.font = `${13 * scale}px "Microsoft YaHei", sans-serif`;
      context.fillText(photoMeta(photo), left, photo.height + 65 * scale);
      context.fillStyle = "#748367"; context.font = `${19 * scale}px "Microsoft YaHei", sans-serif`;
      const lines = []; let line = "";
      for (const character of photo.note || "把这一刻，留给以后。") {
        if (character === "\n" || context.measureText(line + character).width > canvas.width - left * 2) { lines.push(line); line = character === "\n" ? "" : character; } else line += character;
      }
      lines.push(line); lines.slice(0, 2).forEach((text, index) => context.fillText(text, left, photo.height + (105 + index * 27) * scale));
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("图片暂时没能导出，请再试一次。");
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `掌心小城-随手拍-${photo.cityName.replace(/[\\/:*?"<>|]/g, "_")}-${photo.createdAt}.png`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) { document.getElementById("roamPhotoError").textContent = error.message || "下载未完成，请再试一次。"; document.getElementById("roamPhotoError").hidden = false; }
    finally { button.disabled = false; }
  }

  paletteList.addEventListener("click", (event) => {
    const card = event.target.closest(".palette-card");
    if (!card) return;
    closeMobileDrawers();
    state.activeType = card.dataset.type;
    state.selectedId = null;
    state.selectedResidentId = null;
    state.editMode = "select";
    updateActiveCard();
    render();
    showToast(state.activeType === "road" ? "拖动小岛连续铺出街道" : `点击小岛，放置${catalog[state.activeType].label}`);
  });

  document.querySelectorAll(".category-tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".category-tab").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    const category = tab.dataset.category;
    document.querySelectorAll(".palette-card").forEach((card) => { card.style.display = category === "all" || card.dataset.category === category ? "flex" : "none"; });
  }));

  document.addEventListener("click", (event) => {
    if (event.target.closest("#openStories")) document.getElementById("storiesPanel").scrollIntoView({ block: "center", behavior: state.reducedMotion ? "instant" : "smooth" });
    const storySeason = event.target.closest("[data-story-season]");
    if (storySeason) changeSeason(storySeason.dataset.storySeason);
    if (event.target.closest("[data-story-accept]") && !saveBlocked && !collectionBusy) {
      if (life.acceptStory()) { render(); persist(); showToast("约定记下了，慢慢布置，等邻居亲自来看看 ♡"); }
    }
    if (event.target.closest("[data-story-garden]")) {
      if (window.matchMedia("(max-width: 760px)").matches && !document.body.classList.contains("mobile-archive-open")) toggleMobileDrawer("archive");
      document.querySelector(".garden-panel").scrollIntoView({ block: "center", behavior: state.reducedMotion ? "instant" : "smooth" });
    }
    const personalPhoto = event.target.closest("[data-personal-photo]");
    if (personalPhoto) openPersonalPhoto(state.photos.find((photo) => photo.id === personalPhoto.dataset.personalPhoto));
    if (event.target.closest("[data-album-start]")) takeRoamPhoto();
    if (event.target.closest("[data-new-city]")) setCollectionMode("new");
    const switchButton = event.target.closest("[data-switch-city]");
    if (switchButton) switchCity(switchButton.dataset.switchCity);
    const copyCity = event.target.closest("[data-copy-city]");
    if (copyCity) setCollectionMode("copy", copyCity.dataset.copyCity);
    const renameCity = event.target.closest("[data-rename-city]");
    if (renameCity) setCollectionMode("rename", renameCity.dataset.renameCity);
    const exportCityButton = event.target.closest("[data-export-city]");
    if (exportCityButton) exportCity(exportCityButton.dataset.exportCity);
    const theme = event.target.closest("[data-theme]");
    if (theme) {
      const oldDefault = PalmCityCollection.templates.find((entry) => entry.id === selectedTheme).cityName;
      selectedTheme = theme.dataset.theme;
      const input = document.getElementById("newCityName");
      if (input.value === oldDefault || input.value.startsWith(oldDefault.slice(0, 12))) input.value = PalmCityCollection.uniqueName(PalmCityCollection.templates.find((entry) => entry.id === selectedTheme).cityName, cityRecords.map((record) => record.data.cityName));
      renderTemplateChoices();
    }
    const postcardButton = event.target.closest("[data-postcard-id]");
    if (postcardButton) openPostcard(state.postcards.find((card) => card.id === postcardButton.dataset.postcardId));
    if (event.target.closest("[data-visitor-id]")) { document.querySelector(".visitor-panel").scrollIntoView({ block: "nearest", behavior: state.reducedMotion ? "instant" : "smooth" }); showToast(visitors.activity()); }
    const environmentMaterial = event.target.closest("[data-place-environment]");
    if (environmentMaterial) chooseMaterial(environmentMaterial.dataset.placeEnvironment);
    const gardenButton = event.target.closest("[data-garden-action]");
    if (gardenButton && !state.viewMode) {
      const id = Number(gardenButton.dataset.gardenId);
      if (gardenButton.dataset.gardenAction === "focus") { selectItem(id); stage.scrollIntoView({ block: "nearest", behavior: state.reducedMotion ? "instant" : "smooth" }); }
      else {
        const sowing = gardenButton.dataset.gardenAction === "sow";
        if (sowing ? environment.sow(id) : environment.water(id)) {
          refreshGardens(); persist();
          showToast(sowing ? "种子已播下，浇一点水或等一场小雨。" : "土壤喝饱了，接下来交给时间。" );
        }
      }
    }
    const wishButton = event.target.closest("[data-wish-id]");
    if (wishButton) { state.focusedWishId = state.focusedWishId === wishButton.dataset.wishId ? null : wishButton.dataset.wishId; updateWishesUI(); }
    if (event.target.closest("[data-close-wish]")) { state.focusedWishId = null; updateWishesUI(); }
    const accept = event.target.closest("[data-accept-wish]");
    if (accept) { life.acceptWish(accept.dataset.acceptWish); render(); persist(); showToast("心愿已回应，慢慢布置就好 ♡"); }
    const material = event.target.closest("[data-wish-material]");
    if (material) chooseMaterial(material.dataset.wishMaterial);
    if (event.target.closest("[data-wish-night]")) { state.minutes = 22 * 60; updateLighting(); updateLifeUI(); persist(); }
    const memoryButton = event.target.closest("[data-memory-id]");
    if (memoryButton) exportPng(state.journal.find((entry) => entry.id === memoryButton.dataset.memoryId));
    const residentButton = event.target.closest("[data-resident-select]");
    if (residentButton) selectResident(residentButton.dataset.residentSelect);
    const actionButton = event.target.closest("[data-edit-action]");
    if (actionButton) runEditAction(actionButton.dataset.editAction);
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "gardenSelect") { state.selectedGardenId = Number(event.target.value); state.selectedId = null; render(); }
  });

  document.querySelectorAll("[data-season-choice]").forEach((button) => button.addEventListener("click", () => changeSeason(button.dataset.seasonChoice)));
  document.querySelectorAll("button[data-weather]").forEach((button) => button.addEventListener("click", () => changeWeather(button.dataset.weather)));
  document.getElementById("weatherAuto").addEventListener("click", () => { environment.setAuto(!environment.weather.auto); updateWeatherUI(); persist(); });
  document.getElementById("rainSound").addEventListener("click", toggleRainSound);
  document.getElementById("motionButton").addEventListener("click", () => { state.reducedMotion = !state.reducedMotion; updateWeatherUI(); persist(); });

  stage.addEventListener("pointermove", (event) => {
    if (touchPointers.has(event.pointerId)) touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "touch" && drag?.mode === "pinch") {
      const points = [...touchPointers.values()];
      if (points.length < 2) return;
      const center = { clientX: (points[0].x + points[1].x) / 2, clientY: (points[0].y + points[1].y) / 2 };
      state.zoom = PalmCityRoaming.clampZoom(drag.zoom * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / drag.distance);
      const local = svg.createSVGPoint(); local.x = center.clientX; local.y = center.clientY;
      const point = local.matrixTransform(svg.getScreenCTM().inverse());
      state.panX = point.x - drag.anchor.x * state.zoom; state.panY = point.y - drag.anchor.y * state.zoom;
      setWorldTransform(); return;
    }
    if (drag?.mode === "touchBlocked") return;
    updateCursor(event);
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > (event.pointerType === "touch" ? 9 : 3)) drag.moved = true;
    if (drag.mode === "touchPending" && drag.moved) {
      drag.mode = state.editMode === "move" && drag.itemId === state.selectedId && drag.itemId != null ? "moveItem" : "pan";
      if (drag.mode === "pan") { hidePlacementPreview(); stage.classList.add("is-panning"); }
    }
    if (drag.mode === "touchPending" && state.activeType && !state.viewMode) showPlacementPreview(event, { ...getWorldPoint(event, state.activeType), type: state.activeType });
    if (drag.mode === "pan") {
      if (drag.moved && (followResidentId || cameraTarget || cameraPreset !== "custom")) {
        stopFollowing(false); cameraPreset = "custom"; updateRoamUI();
      }
      const scale = svg.getScreenCTM().a;
      state.panX = drag.panX + dx / scale;
      state.panY = drag.panY + dy / scale;
      setWorldTransform();
    }
    if (drag.mode === "paintRoad") {
      const point = getWorldPoint(event, "road");
      if (!drag.lastPoint || point.x !== drag.lastPoint.x || point.y !== drag.lastPoint.y) {
        paintRoadTo(point);
      }
    }
    if (drag.mode === "moveItem") {
      const item = state.items.find((candidate) => candidate.id === drag.itemId);
      if (!item) return;
      if (drag.moved && !drag.snapshotTaken) {
        snapshot("移动元素"); drag.snapshotTaken = true;
        state.selectedId = item.id; state.selectedResidentId = null;
      }
      if (drag.moved) {
        const pointer = getWorldPoint(event, item.type, false);
        const { x, y } = PalmCityBuilding.snap({ x: drag.itemX + pointer.x - drag.startPoint.x, y: drag.itemY + pointer.y - drag.startPoint.y }, item.type);
        drag.invalidPosition = !isOnIsland({ x, y }) || (item.type === "road" && state.items.some(other => other.type === "road" && other.id !== item.id && Math.abs(other.x - x) < 4 && Math.abs(other.y - y) < 4));
        if (!drag.invalidPosition && (item.x !== x || item.y !== y)) {
          item.x = x; item.y = y;
          render();
        }
        showPlacementPreview(event, { ...item, x, y }, true);
      }
    }
  });

  stage.addEventListener("pointerleave", () => { placementCursor.style.display = "none"; if (!drag) hidePlacementPreview(); });

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest?.("button, .resident-popover, .selection-note")) return;
    if (cameraTarget && !followResidentId) stopFollowing(false);
    if (event.pointerType === "touch") {
      event.preventDefault();
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture?.(event.pointerId);
      if (touchPointers.size >= 2) {
        stopFollowing(false); cameraPreset = "custom"; updateRoamUI();
        const before = editHistory.cancel();
        if (before) { state.items = before; render(); }
        hidePlacementPreview();
        const points = [...touchPointers.values()];
        const center = { clientX: (points[0].x + points[1].x) / 2, clientY: (points[0].y + points[1].y) / 2 };
        drag = { mode: "pinch", zoom: state.zoom, anchor: getWorldPoint(center, null, false), distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) };
      } else {
        const item = state.items.find((entry) => entry.id === Number(event.target.closest?.("[data-item-id]")?.dataset.itemId));
        drag = { mode: "touchPending", x: event.clientX, y: event.clientY, moved: false, itemId: item?.id, itemX: item?.x, itemY: item?.y,
          residentId: event.target.closest?.("[data-resident-id]")?.dataset.residentId, visitor: !!event.target.closest?.("[data-visitor-id]"),
          startPoint: getWorldPoint(event, item?.type, false), panX: state.panX, panY: state.panY };
        if (!state.viewMode && state.activeType) showPlacementPreview(event, { ...getWorldPoint(event, state.activeType), type: state.activeType });
        else if (!state.viewMode && state.editMode === "move" && item?.id === state.selectedId) showPlacementPreview(event, item, true);
      }
      return;
    }
    if (event.target.closest?.("[data-visitor-id]") && !state.activeType) return;
    const residentTarget = event.target.closest?.("[data-resident-id]");
    if (residentTarget && !state.activeType) { selectResident(residentTarget.dataset.residentId); return; }
    if (!state.viewMode && state.activeType === "road") {
      hidePlacementPreview();
      stage.setPointerCapture?.(event.pointerId);
      drag = { x: event.clientX, y: event.clientY, moved: false, mode: "paintRoad", lastPoint: null, snapshotTaken: false };
      paintRoadTo(getWorldPoint(event, "road"));
      return;
    }
    if (!state.viewMode && state.activeType) { placeItem(event); return; }
    const itemTarget = event.target.closest?.("[data-item-id]");
    if (itemTarget && !state.viewMode) {
      event.stopPropagation();
      const itemId = Number(itemTarget.dataset.itemId);
      const item = state.items.find((candidate) => candidate.id === itemId);
      if (item) drag = { x: event.clientX, y: event.clientY, moved: false, mode: "moveItem", itemId, snapshotTaken: false, itemX: item.x, itemY: item.y, startPoint: getWorldPoint(event, item.type, false) };
      stage.setPointerCapture?.(event.pointerId);
      return;
    }
    stage.setPointerCapture?.(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, moved: false, mode: "pan", panX: state.panX, panY: state.panY };
    stage.classList.add("is-panning");
  });

  stage.addEventListener("pointerup", (event) => {
    hidePlacementPreview();
    touchPointers.delete(event.pointerId);
    if (!drag) return;
    if (["pinch", "touchBlocked"].includes(drag.mode)) {
      drag = touchPointers.size ? { mode: "touchBlocked" } : null; persist(); return;
    }
    if (drag.mode === "touchPending") {
      const tap = drag; drag = null;
      if (!state.viewMode && state.activeType) placeItem(event);
      else if (tap.residentId) selectResident(tap.residentId);
      else if (tap.visitor) showToast(visitors.activity());
      else if (tap.itemId != null && !state.viewMode) selectItem(tap.itemId);
      else { state.selectedId = null; state.selectedResidentId = null; render(); }
      return;
    }
    if (drag.mode === "select" && !drag.moved) selectItem(drag.itemId);
    if (drag.mode === "moveItem") {
      if (!drag.moved) selectItem(drag.itemId);
      else {
        let changed = false;
        if (drag.invalidPosition) { const previous = editHistory.cancel(); if (previous) state.items = previous; }
        else changed = commitLayout();
        state.editMode = "select";
        if (changed) state.lastEdited = Date.now();
        render(); persist();
        showToast(drag.invalidPosition ? "落点不可用，已保留原位置" : changed ? "元素位置已更新" : "位置没有变化");
      }
    }
    if (drag.mode === "paintRoad") {
      const changed = commitLayout();
      state.activeType = null;
      state.editMode = "select";
      updateActiveCard();
      render();
      persist();
      showToast(changed ? "街道已连接，邻居们会重新规划行程" : "这里没有新的可用落点");
    }
    if (drag.mode === "pan") {
      if (!drag.moved) { state.selectedId = null; state.selectedResidentId = null; render(); }
      stage.classList.remove("is-panning"); persist();
    }
    drag = null;
  });
  stage.addEventListener("pointercancel", () => {
    if (cancelBuildGesture()) { render(); persist(); }
  });
  window.addEventListener("blur", () => { if (cancelBuildGesture()) { render(); persist(); } });

  stage.addEventListener("wheel", (event) => {
    if (event.target.closest?.(".selection-note")) return;
    event.preventDefault();
    setZoom(state.zoom + (event.deltaY > 0 ? -0.08 : 0.08), { x: event.clientX, y: event.clientY });
  }, { passive: false });

  undoButton.addEventListener("click", undo);
  document.getElementById("guideAction").addEventListener("click", runGuideAction);
  document.getElementById("toggleGuide").addEventListener("click", () => {
    guideCollapsed = !guideCollapsed;
    document.getElementById("guideContent").hidden = guideCollapsed;
    document.getElementById("toggleGuide").setAttribute("aria-expanded", String(!guideCollapsed));
    document.getElementById("toggleGuide").textContent = guideCollapsed ? "展开 ＋" : "收起 −";
  });
  redoButton.addEventListener("click", redo);
  document.getElementById("openCollection").addEventListener("click", () => openCollection());
  document.getElementById("mobileCollection").addEventListener("click", () => openCollection());
  document.getElementById("newCityButton").addEventListener("click", () => openCollection("new"));
  document.getElementById("quickDuplicate").addEventListener("click", () => openCollection("copy"));
  document.getElementById("galleryNewCity").addEventListener("click", () => setCollectionMode("new"));
  document.getElementById("backToGallery").addEventListener("click", () => setCollectionMode("gallery"));
  document.getElementById("closeCollection").addEventListener("click", () => document.getElementById("collectionDialog").close());
  document.getElementById("cityCreateForm").addEventListener("submit", submitCityForm);
  document.getElementById("importCityButton").addEventListener("click", () => document.getElementById("importCityFile").click());
  document.getElementById("importCityFile").addEventListener("change", (event) => importCityFile(event.target.files[0]));
  document.getElementById("rescueCopy").addEventListener("click", rescueCity);
  document.getElementById("rescueExport").addEventListener("click", () => exportCity());
  document.getElementById("reloadCity").addEventListener("click", () => collectionWork(async () => {
    if (!currentCity) { location.reload(); return; }
    await Promise.allSettled([...captureTasks]); await saveChain;
    const record = await collection.get(currentCity.id); if (record) activateCity(record);
  }));
  document.getElementById("mobileBuild").addEventListener("click", () => toggleMobileDrawer("build"));
  document.getElementById("mobileArchive").addEventListener("click", () => toggleMobileDrawer("archive"));
  document.getElementById("mobileDrawerShade").addEventListener("click", closeMobileDrawers);
  document.getElementById("closeMobileArchive").addEventListener("click", closeMobileDrawers);
  document.getElementById("mobileUndo").addEventListener("click", undo);
  document.getElementById("mobileRedo").addEventListener("click", redo);
  document.getElementById("mobilePan").addEventListener("click", () => { closeMobileDrawers(); state.activeType = null; state.selectedId = null; state.editMode = "select"; updateActiveCard(); render(); showToast("拖动画面浏览小城，双指可缩放。"); });
  document.getElementById("cancelMobileBuild").addEventListener("click", () => { state.activeType = null; state.editMode = "select"; updateActiveCard(); render(); });
  document.querySelectorAll("#guideAction, #toggleGuide, .mobile-city-tools button, #closeMobileArchive, #closeResident, #cancelMobileBuild, #editToolbar button, .roam-toolbar button, .season-switch button, .zoom-controls button, #followResident, #stopFollowing").forEach(enableTouchCommand);
  document.querySelectorAll("[data-camera-preset]").forEach((button) => button.addEventListener("click", () => setCameraPreset(button.dataset.cameraPreset)));
  document.getElementById("followResident").addEventListener("click", startFollowing);
  document.getElementById("stopFollowing").addEventListener("click", () => stopFollowing());
  document.getElementById("takeRoamPhoto").addEventListener("click", takeRoamPhoto);
  document.getElementById("openPersonalAlbum").addEventListener("click", openPersonalAlbum);
  document.getElementById("openAlbumArchive").addEventListener("click", openPersonalAlbum);
  document.getElementById("closeAlbum").addEventListener("click", () => document.getElementById("albumDialog").close());
  document.getElementById("albumTakePhoto").addEventListener("click", takeRoamPhoto);
  document.getElementById("undoDeletePhoto").addEventListener("click", undoDeletePhoto);
  document.getElementById("closeRoamPhoto").addEventListener("click", () => document.getElementById("roamPhotoDialog").close());
  document.getElementById("roamPhotoDialog").addEventListener("close", () => { photoDraft = photoDraftCityId = null; });
  document.getElementById("roamPhotoNote").addEventListener("input", (event) => { document.getElementById("roamPhotoNoteCount").textContent = `${event.target.value.length} / 80`; });
  document.getElementById("roamPhotoForm").addEventListener("submit", savePersonalPhoto);
  document.getElementById("deletePersonalPhoto").addEventListener("click", deletePersonalPhoto);
  document.getElementById("downloadPersonalPhoto").addEventListener("click", downloadPersonalPhoto);
  deleteButton.addEventListener("click", deleteSelected);
  document.getElementById("clearSelection").addEventListener("click", () => { state.selectedId = null; state.editMode = "select"; render(); });
  document.getElementById("zoomIn").addEventListener("click", () => setZoom(state.zoom + .1));
  document.getElementById("zoomOut").addEventListener("click", () => setZoom(state.zoom - .1));
  document.getElementById("zoomReset").addEventListener("click", resetView);
  document.getElementById("exportButton").addEventListener("click", exportPng);
  document.getElementById("journalMore").addEventListener("click", () => { journalExpanded = !journalExpanded; updateJournalUI(); });
  document.getElementById("travelMore").addEventListener("click", () => { travelExpanded = !travelExpanded; updateTravelUI(); });
  document.getElementById("inviteVisitor").addEventListener("click", () => {
    syncVisitors();
    if (visitors.invite()) { render(); persist(); showToast(state.paused ? "小船已出发，点「继续」让它靠岸。" : "阿远正在乘船来，去码头迎一迎吧。"); }
  });
  document.getElementById("cancelVisit").addEventListener("click", () => { visitors.cancel(); collectVisitorEvents(); render(); persist(); });
  document.getElementById("closePhoto").addEventListener("click", () => document.getElementById("photoDialog").close());
  document.getElementById("viewButton").addEventListener("click", () => setViewMode(!state.viewMode));
  document.getElementById("closeResident").addEventListener("click", () => { state.selectedResidentId = null; updateLifeUI(); renderResidentPositions(); });
  document.getElementById("pauseButton").addEventListener("click", () => { state.paused = !state.paused; updateLighting(); updateLifeUI(); updateWeatherUI(); updateGardenUI(); persist(); });
  document.querySelectorAll("button[data-period]").forEach((button) => button.addEventListener("click", () => {
    state.minutes = ({ day: 9, dusk: 18, night: 22 })[button.dataset.period] * 60;
    updateLighting(); persist();
  }));
  document.getElementById("resetButton").addEventListener("click", () => {
    cancelBuildGesture();
    snapshot("恢复初始布局");
    const theme = PalmCityCollection.templates.find((entry) => entry.id === currentCity?.theme);
    state.items = theme ? PalmCityCollection.buildTemplate(theme.id).items : cloneItems(initialItems);
    commitLayout();
    state.selectedId = null;
    state.activeType = null;
    state.editMode = "select";
    state.selectedResidentId = null;
    resetView();
    updateActiveCard();
    render();
    persist();
    showToast("这座小城已恢复初始布局，可以撤销。");
  });
  cityName.addEventListener("input", () => { state.cityName = cityName.value.trim() || "未命名小城"; state.lastEdited = Date.now(); updateLifeUI(); persist(); });
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    if (event.target.closest?.("input, textarea, [contenteditable='true']")) return;
    const resident = event.target.closest?.("[data-resident-id]");
    if (event.target.closest?.("[data-visitor-id]") && ["Enter", " "].includes(event.key)) { event.preventDefault(); document.querySelector(".visitor-panel").scrollIntoView({ block: "nearest" }); showToast(visitors.activity()); return; }
    if (resident && ["Enter", " "].includes(event.key)) { event.preventDefault(); selectResident(resident.dataset.residentId); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && document.activeElement !== cityName) { event.preventDefault(); deleteSelected(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    if (event.key === "Escape") {
      if (cancelBuildGesture()) persist();
      if (followResidentId || cameraTarget) { stopFollowing(); return; }
      if (state.viewMode) { setViewMode(false); return; }
      state.activeType = null; state.selectedId = null; state.selectedResidentId = null; state.focusedWishId = null; state.editMode = "select"; updateActiveCard(); render();
    }
  });

  async function initializeCollection() {
    document.querySelector(".workspace").inert = true;
    try {
      cityRecords = await collection.list();
      if (!cityRecords.length) {
        for (const key of LEGACY_KEYS) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const saved = JSON.parse(raw);
            if (!saved || !Array.isArray(saved.items)) continue;
            readState(saved, key.startsWith("palm-city-state-v2"));
            break;
          } catch (error) { console.info("Unable to read legacy city", error); }
        }
        life.sync(state.items); environment.sync(state.items);
        await collection.seed(PalmCityCollection.makeRecord(cityData(), "original"));
        cityRecords = await collection.list();
      }
      cityRecords.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      let activeId;
      try { activeId = localStorage.getItem(ACTIVE_CITY_KEY); } catch {}
      ready = true;
      activateCity(cityRecords.find((record) => record.id === activeId) || cityRecords[0]);
      drawGrid(); drawRain(); await writeState();
      document.querySelector(".workspace").inert = false;
      document.body.classList.remove("is-loading");
      requestAnimationFrame(animate);
    } catch (error) {
      console.error("Unable to open collection", error);
      document.body.classList.remove("is-loading");
      document.getElementById("collectionNotice").hidden = false;
      document.getElementById("collectionNoticeText").textContent = "收藏馆暂时未能打开，原有存档仍保留。请点击「重新载入」再试一次。";
      saveState.textContent = "收藏馆未能载入";
    }
  }
  document.addEventListener("visibilitychange", () => { lastFrame = null; updateWeatherUI(); if (document.hidden) writeState(); });
  window.addEventListener("pagehide", writeState);
  new ResizeObserver(resizeViewport).observe(stage);
  initializeCollection();
})();
