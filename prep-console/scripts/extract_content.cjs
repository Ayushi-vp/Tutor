/* One-off migration: evaluate the old single-file bundle and dump its data
 * to editable JSON under content/.  Run from prep-console/:
 *   node scripts/extract_content.cjs ../src/build/artifact.html
 */
const fs = require("fs");
const path = require("path");

const built = process.argv[2] || path.join(__dirname, "..", "..", "src", "build", "artifact.html");
const html = fs.readFileSync(built, "utf8");
const src = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/)[1].replace(/\(function boot\(\)\{[\s\S]*$/, "");

const noop = () => {};
const el = { setAttribute: noop, removeAttribute: noop, addEventListener: noop, appendChild: noop,
  querySelector: () => null, querySelectorAll: () => [], classList: { add: noop, remove: noop, toggle: noop }, style: {} };
global.window = { matchMedia: () => ({ matches: false }), addEventListener: noop };
global.matchMedia = global.window.matchMedia;
global.document = { documentElement: el, addEventListener: noop, dispatchEvent: noop,
  querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ ...el }) };
global.localStorage = { getItem: () => null, setItem: noop };
global.CustomEvent = function () {};
global.location = { hash: "" };
global.history = { replaceState: noop };

const m = new Function(src + `
  return { TOPICS, DSA, PATTERNS, BANK, HLD, LLD, CLASSICS, INFRA, ROADMAP, CATS, BLURB, PAT_NAME };`)();

const out = path.join(__dirname, "..", "content");
const write = (rel, data) => {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", rel, Array.isArray(data) ? data.length + " rows" : "");
};
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined && o[k] !== null).map(k => [k, o[k]]));

const TOPIC_KEYS = ["id", "t", "tag", "sum", "viz", "body", "drill", "qa", "refs"];
const DESIGN_KEYS = ["id", "t", "tag", "sum", "primer", "body", "deep", "drill", "qa", "refs"];

for (const [k, list] of Object.entries(m.TOPICS)) write(`tracks/${k}.json`, list.map(t => pick(t, TOPIC_KEYS)));
for (const [k, list] of [["classic", m.CLASSICS], ["infra", m.INFRA], ["hld", m.HLD], ["lld", m.LLD]])
  write(`designs/${k}.json`, list.map(d => pick(d, DESIGN_KEYS)));

write("patterns.json", m.PATTERNS);
write("dsa.json", m.DSA);
// Only the hand-written bank rows: quick checks are derived from topics/designs at load time.
write("bank.json", m.BANK.filter(b => !b.src).map(b => pick(b, ["id", "cat", "d", "q", "a"])));
write("roadmap.json", m.ROADMAP);
write("meta.json", { cats: m.CATS, blurb: m.BLURB });
console.log("bank total in old build:", m.BANK.length);
