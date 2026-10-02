/* Smoke-test the built page without a browser.
 *
 *   node src/tools/check.js
 *
 * Parses the bundled script, then renders every chart and every view in a
 * stubbed DOM. Catches syntax errors, undefined references and empty output —
 * the failures that would otherwise only show up as a blank panel in the page.
 */
const fs = require("fs");
const path = require("path");

const built = path.join(__dirname, "..", "build", "artifact.html");
if (!fs.existsSync(built)) {
  console.error("No build found. Run:  sh src/build.sh");
  process.exit(1);
}

// Pull the single <script> block out of the bundle, minus the boot IIFE (it needs a real DOM).
const html = fs.readFileSync(built, "utf8");
const m = html.match(/^<script>\r?\n([\s\S]*?)\r?\n<\/script>/m);
if (!m) { console.error("Could not find the script block in the build."); process.exit(1); }
const src = m[1].replace(/\(function boot\(\)\{[\s\S]*$/, "");

/* --- minimal DOM stub --- */
const noop = () => {};
const el = {
  setAttribute: noop, removeAttribute: noop, addEventListener: noop, appendChild: noop,
  querySelector: () => null, querySelectorAll: () => [], focus: noop, closest: () => null,
  getAttribute: () => null, dispatchEvent: noop,
  classList: { add: noop, remove: noop, toggle: noop },
  style: {}, dataset: {}, textContent: "", innerHTML: "", hidden: false, value: ""
};
global.window = { matchMedia: () => ({ matches: false }), addEventListener: noop };
global.matchMedia = () => ({ matches: false });
global.document = {
  documentElement: el, addEventListener: noop, dispatchEvent: noop,
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => Object.assign({}, el), activeElement: { tagName: "BODY" }
};
global.localStorage = { getItem: () => null, setItem: noop };
global.CustomEvent = function (n, o) { this.type = n; Object.assign(this, o || {}); };
global.location = { hash: "" };
global.history = { replaceState: noop };
global.requestAnimationFrame = noop;

let mod;
try {
  mod = new Function(src + `
    return { VIZ, TOPICS, DSA, BANK, PATTERNS, HLD, LLD, CLASSICS, INFRA, ROADMAP, ROUNDS, PILLARS, allIds,
             viewOverview, viewRoadmap, viewDSA, viewBank, viewCards, viewMock,
             viewTopics, viewDesign, searchAll };`)();
} catch (e) {
  console.error("FAILED to evaluate the bundle:", e.message);
  process.exit(1);
}

let bad = 0;
const fail = (what, why) => { console.log("  FAIL  " + what + " — " + why); bad++; };

console.log("charts");
for (const k of Object.keys(mod.VIZ)) {
  try {
    const h = mod.VIZ[k].html();
    if (!h || h.length < 200) fail(k, "produced " + (h || "").length + " chars");
  } catch (e) { fail(k, e.message); }
}
console.log("  " + Object.keys(mod.VIZ).length + " rendered");

console.log("views");
const views = {
  overview: mod.viewOverview, roadmap: mod.viewRoadmap, dsa: mod.viewDSA,
  bank: mod.viewBank, cards: mod.viewCards, mock: mod.viewMock
};
for (const [n, f] of Object.entries(views)) {
  try { if (f().length < 500) fail(n, "suspiciously short"); } catch (e) { fail(n, e.message); }
}
for (const k of ["ml", "dl", "llm", "aieng", "ts"]) {
  try { if (mod.viewTopics(k, "e", "t", "l").length < 500) fail("topics:" + k, "short"); }
  catch (e) { fail("topics:" + k, e.message); }
}
for (const [n, d] of [["hld", mod.HLD], ["lld", mod.LLD], ["classic", mod.CLASSICS], ["infra", mod.INFRA]]) {
  try { if (mod.viewDesign(d, "a", "b", "c", "d").length < 500) fail(n, "short"); }
  catch (e) { fail(n, e.message); }
}
console.log("  14 rendered");

console.log("mock rounds");
for (const r of mod.ROUNDS) {
  try { if (!r.pick().length) fail("round " + r.id, "drew no questions"); }
  catch (e) { fail("round " + r.id, e.message); }
}
console.log("  " + mod.ROUNDS.length + " draw cleanly");

console.log("depth packs");
for (const [sec, list] of Object.entries(mod.TOPICS)) {
  const withRefs = list.filter(t => t.refs), withDrill = list.filter(t => t.drill);
  const links = list.reduce((a, t) => a + (t.refs ? t.refs.length : 0), 0);
  const checks = list.reduce((a, t) => a + (t.qa ? t.qa.length : 0), 0);
  list.forEach(t => (t.qa || []).forEach(r => {
    if (r.length !== 3) fail(t.id + ' qa', 'expected [difficulty, q, a], got ' + r.length + ' fields');
    else if (!/^[EMH]$/.test(r[0])) fail(t.id + ' qa', 'bad difficulty: ' + r[0]);
  }));
  list.forEach(t => (t.refs || []).forEach(r => {
    if (r.length !== 4) fail(t.id + " ref", "expected 4 fields, got " + r.length);
    else if (!/^https:\/\//.test(r[3])) fail(t.id + " ref", "not an https url: " + r[3]);
  }));
  console.log("  " + sec.padEnd(6) + list.length + " topics · " +
    withDrill.length + " exercises · " + checks + " checks · " + links + " links");
}

console.log("design depth");
for (const [name, list] of [["hld", mod.HLD], ["lld", mod.LLD], ["classic", mod.CLASSICS], ["infra", mod.INFRA]]) {
  const primers = list.filter(d => d.primer), deeps = list.filter(d => d.deep);
  const drills = list.filter(d => d.drill);
  const checks = list.reduce((a, d) => a + (d.qa ? d.qa.length : 0), 0);
  const links = list.reduce((a, d) => a + (d.refs ? d.refs.length : 0), 0);
  list.forEach(d => {
    if (d.drill && !/<details>/.test(d.drill)) fail(d.id + " drill", "no revealed answer");
    (d.qa || []).forEach(r => {
      if (r.length !== 3) fail(d.id + " qa", "expected [difficulty, q, a], got " + r.length + " fields");
      else if (!/^[EMH]$/.test(r[0])) fail(d.id + " qa", "bad difficulty: " + r[0]);
    });
    (d.refs || []).forEach(r => {
      if (r.length !== 4) fail(d.id + " ref", "expected 4 fields, got " + r.length);
      else if (!/^https:\/\//.test(r[3])) fail(d.id + " ref", "not an https url: " + r[3]);
    });
  });
  if (primers.length !== list.length) fail(name, (list.length - primers.length) + " design(s) with no primer");
  if (deeps.length !== list.length) fail(name, (list.length - deeps.length) + " design(s) with no senior layer");
  console.log("  " + name.padEnd(8) + list.length + " designs · " + primers.length + " primers · " +
    drills.length + " exercises · " + checks + " checks · " + links + " links");
}

console.log("content");
console.log("  DSA " + mod.DSA.length + " · patterns " + mod.PATTERNS.length +
  " · bank " + mod.BANK.length + " · classics " + mod.CLASSICS.length + " · infra " + mod.INFRA.length +
  " · HLD " + mod.HLD.length + " · LLD " + mod.LLD.length +
  " · tracked ids " + mod.allIds().length);

const bankIds = mod.BANK.map(b => b.id);
const bankDupes = bankIds.filter((x, i) => bankIds.indexOf(x) !== i);
if (bankDupes.length) fail("bank", "duplicate bank ids: " + [...new Set(bankDupes)].join(", "));

const ids = mod.allIds();
const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dupes.length) fail("ids", "duplicate tracked ids: " + [...new Set(dupes)].join(", "));

console.log(bad ? "\n*** " + bad + " PROBLEM(S)" : "\n*** ALL CLEAN");
process.exit(bad ? 1 : 0);
