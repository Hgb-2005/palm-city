(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PalmCitySeasons = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const seasons = {
    spring: { label: "春日", symbol: "❀", title: "花开的时候，慢一点走", hint: "树梢开着小花，风里都是新鲜的日常。", color: "#a0ad85", paper: "#edf0df", sky: ["#f9f0e4", "#e8eedc"], land: ["#e0e5bd", "#b5c695"], side: ["#a8b582", "#81966b"], tree: ["#9fb68b", "#c3d49e", "#819d75"] },
    summer: { label: "夏日", symbol: "☀", title: "树荫里，藏着一个夏天", hint: "叶子浓绿了，戴上草帽去街角散散步。", color: "#688e79", paper: "#e1ece2", sky: ["#e7f2eb", "#d5e8de"], land: ["#cddca4", "#9dbb80"], side: ["#8ea978", "#628c6a"], tree: ["#649878", "#91b789", "#4f7d64"] },
    autumn: { label: "秋日", symbol: "❧", title: "把落叶，留在回家的路上", hint: "树梢染上金黄，脚边多了几片暖暖的叶子。", color: "#ad8259", paper: "#f1e5cf", sky: ["#faeedb", "#eee0c8"], land: ["#e9d4a6", "#ceba87"], side: ["#c5ac79", "#9e8c63"], tree: ["#c39362", "#e0b778", "#ad7954"] },
    winter: { label: "冬日", symbol: "❄", title: "雪落过，灯火就更暖了", hint: "屋檐和树梢覆着薄雪，围好围巾再出门。", color: "#839ba5", paper: "#e8eef0", sky: ["#eaf0f1", "#dce7e8"], land: ["#edf0e5", "#d6e0d7"], side: ["#b9cdc4", "#91aba3"], tree: ["#9bafa4", "#c1cec0", "#80998e"] },
  };
  const isSeason = (value) => typeof value === "string" && Object.prototype.hasOwnProperty.call(seasons, value);
  const normalize = (value) => isSeason(value) ? value : "spring";
  const get = (value) => seasons[normalize(value)];
  const label = (value) => isSeason(value) ? seasons[value].label : "";
  function mix(a, b, progress) {
    const channels = (color) => color.startsWith("#") ? [1, 3, 5].map((n) => parseInt(color.slice(n, n + 2), 16)) : color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const p = Math.max(0, Math.min(1, Number(progress) || 0)), first = channels(a), second = channels(b);
    return `rgb(${first.map((value, i) => Math.round(value * (1 - p) + second[i] * p)).join(",")})`;
  }
  function tint(color, key, index, season, hour) {
    const palette = get(season);
    if (!["sky", "land", "side"].includes(key) || ![0, 1].includes(index)) return color;
    const h = ((Number(hour) || 0) % 24 + 24) % 24;
    const daylight = Math.max(0, Math.min(1, (h - 6) / 2, (20 - h) / 4));
    // Keep the existing dusk and night lighting legible in every season.
    return mix(color, palette[key][index], daylight * (key === "sky" ? .45 : .82));
  }
  function treeDecor(season, seed = 0) {
    if (season === "spring") return `<g class="season-blossoms" pointer-events="none" fill="#f3d5d0" stroke="#e3b8ad" stroke-width=".6">${[[-21, -10], [3, -38], [19, -14], [-4, -16], [-13, -32]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${(Number(seed) + i) % 3 * 20})"><circle cx="-2.5" r="2.6"/><circle cx="2.5" r="2.6"/><circle cy="-2.5" r="2.6"/><circle cy="2.5" r="2.6"/><circle r="1.6" fill="#f4e3ae" stroke="none"/></g>`).join("")}</g>`;
    if (season === "autumn") return `<g class="season-leaves" pointer-events="none">${[[-27, 27], [23, 32], [-10, 37], [36, 23], [7, 28]].map(([x, y], i) => `<path transform="translate(${x} ${y}) rotate(${(Number(seed) % 5) * 11 + i * 53})" d="M-5 0Q0-7 6 0Q0 6-5 0ZM-4 0H5" fill="${i % 2 ? "#b77c50" : "#ddb772"}" stroke="#a47f51" stroke-width=".6"/>`).join("")}</g>`;
    if (season === "winter") return '<g class="season-snow" pointer-events="none" fill="#f1f5ee" stroke="#d8e3dc" stroke-width=".8"><path d="M-32-11Q-28-23-15-23Q-20-10-30-7Z"/><path d="M-19-30Q-16-45 0-46Q16-46 20-30Q10-23 1-28Q-9-24-19-30Z"/><path d="M8-17Q22-29 34-14L33-6Q24-11 19-8Q10-9 8-17Z"/><ellipse cx="-10" cy="35" rx="19" ry="3.5"/></g>';
    return "";
  }
  function snowCap(type, raised = false) {
    const y = raised ? -20 : -4;
    const paths = {
      house: `M-34 ${y}L0 ${y - 32}L34 ${y}L28 ${y + 2}L0 ${y - 25}L-28 ${y + 2}Z`,
      shop: "M-35-5L0-28L35-5L30-3L0-22L-30-3Z",
      pavilion: "M-48-19L0-58L48-19L40-18L0-51L-40-18Z",
      bench: "M-30-19H30V-15H-30Z",
      dock: "M-59-10H8L12-6H-59Z",
    };
    return Object.prototype.hasOwnProperty.call(paths, type) ? `<path class="season-snow roof-snow" d="${paths[type]}" fill="#f2f6ef" stroke="#d4e0d8" stroke-width=".7" stroke-linejoin="round" pointer-events="none"/>` : "";
  }
  function groundDecor(season) {
    const spots = [[-300, -160], [-150, 150], [120, -185], [300, 65], [-340, 30], [180, 170], [25, -175]];
    if (season === "winter") return spots.map(([x, y], i) => `<path class="snow-patch" d="M${x - 24} ${y}q19-11 44-2q12 7-2 10q-32 7-49-2Z" fill="#f5f7ef" opacity="${i % 2 ? .6 : .8}"/>`).join("");
    if (season === "spring") return spots.map(([x, y]) => `<g fill="#e4b7b1" opacity=".8"><ellipse cx="${x}" cy="${y}" rx="2.5" ry="1.4"/><ellipse cx="${x + 12}" cy="${y + 5}" rx="2" ry="1.4"/></g>`).join("");
    return "";
  }
  function outfit(season, slot = 0) {
    if (season === "summer") return '<g class="season-outfit resident-straw-hat" pointer-events="none"><path d="M-7-30L-5-37Q0-39 5-37L7-30Z" fill="#dbc289" stroke="#b59b66" stroke-width=".7"/><ellipse cy="-30" rx="11" ry="2.6" fill="#e8cf96" stroke="#bea36c" stroke-width=".6"/><path d="M-6-32H6" stroke="#a58b64" stroke-width="1.5"/></g>';
    if (season === "winter") return `<g class="season-outfit resident-winter-scarf" pointer-events="none" fill="${["#b37f70", "#718f9c", "#bf9d67", "#8f859f", "#849874"][Math.abs(Number(slot) || 0) % 5]}"><path d="M-7-19Q0-16 7-19V-15Q0-12-7-15Z"/><path d="M3-16L8-16L9-6L5-5Z"/><path d="M-6-28Q-6-35 0-35Q7-35 7-28Z"/><circle cy="-36" r="2.5" fill="#e9e5d4"/></g>`;
    return "";
  }
  function residentLine(season, resident = {}, weather = "sunny") {
    if (resident.phase === "sheltered") return "在凉亭里，等晴。";
    if (weather === "rain") return season === "winter" ? "围好围巾，去听雨。" : "带好伞，慢慢走。";
    const lines = {
      spring: ["转角的小花，又开了。", "把春天装进日常。", "风里有新叶的味道。"],
      summer: ["戴上草帽去树下。", "树下的风，凉一点。", "夏天，可以慢一些。"],
      autumn: ["回家的路，落叶金黄。", "捡片秋叶夹进书里。", "秋天的光，暖暖的。"],
      winter: ["围好围巾再出门。", "雪后的路，慢慢走。", "回家泡杯热茶吧。"],
    };
    return lines[normalize(season)][Math.abs(Number(resident.slot) || 0) % 3];
  }
  return { seasons, isSeason, normalize, get, label, tint, treeDecor, snowCap, groundDecor, outfit, residentLine };
});
