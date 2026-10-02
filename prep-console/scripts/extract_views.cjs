/* Capture the per-page eyebrow/title/lede/note text by running the old router. */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(process.argv[2], "utf8");
let src = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/)[1].replace(/\(function boot\(\)\{[\s\S]*$/, "");
const noop = () => {};
const node = () => ({ setAttribute: noop, removeAttribute: noop, addEventListener: noop, focus: noop,
  querySelector: () => null, querySelectorAll: () => [], classList: { add: noop, remove: noop, toggle: noop }, style: {}, innerHTML: "" });
global.window = { matchMedia: () => ({ matches: false }), addEventListener: noop, scrollTo: noop };
global.matchMedia = global.window.matchMedia;
global.document = { documentElement: node(), addEventListener: noop, dispatchEvent: noop,
  querySelector: () => node(), querySelectorAll: () => [], createElement: node };
global.localStorage = { getItem: () => null, setItem: noop };
global.CustomEvent = function () {}; global.location = { hash: "" }; global.history = { replaceState: noop };
const rec = {};
const api = new Function("rec", src + `
  const T = viewTopics, D = viewDesign;
  viewTopics = (key, eyebrow, title, lede) => { rec[key] = { kind:"track", eyebrow, title, lede }; return ""; };
  viewDesign = (list, eyebrow, title, lede, note) => { rec.__last = { kind:"design", eyebrow, title, lede, note }; return ""; };
  return { setView: v => { view = v; }, render };`)(rec);
for (const v of ["ml", "dl", "llm", "aieng", "ts", "classic", "infra", "hld", "lld"]) {
  api.setView(v); api.render();
  if (rec.__last) { rec[v] = rec.__last; delete rec.__last; }
}
fs.writeFileSync(path.join(__dirname, "..", "content", "views.json"), JSON.stringify(rec, null, 2) + "\n");
console.log(Object.keys(rec));
