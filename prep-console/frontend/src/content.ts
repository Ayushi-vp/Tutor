/* All curriculum content, loaded from ../content/*.json at build time.
   Edit the JSON to change what the app teaches; nothing here needs to change
   unless you add a new track, design family or bank category. */
import ml from "@content/tracks/ml.json";
import dl from "@content/tracks/dl.json";
import llm from "@content/tracks/llm.json";
import aieng from "@content/tracks/aieng.json";
import ts from "@content/tracks/ts.json";
import swe from "@content/tracks/swe.json";
import gpu from "@content/tracks/gpu.json";
import rs from "@content/tracks/rs.json";
import mm from "@content/tracks/mm.json";
import net from "@content/tracks/net.json";
import scale from "@content/tracks/scale.json";
import py from "@content/tracks/py.json";
import classic from "@content/designs/classic.json";
import infra from "@content/designs/infra.json";
import hld from "@content/designs/hld.json";
import lld from "@content/designs/lld.json";
import mlc from "@content/designs/mlc.json";
import patterns from "@content/patterns.json";
import dsa from "@content/dsa.json";
import bank from "@content/bank.json";
import roadmap from "@content/roadmap.json";
import rounds from "@content/rounds.json";
import meta from "@content/meta.json";
import views from "@content/views.json";

export type Level = "E" | "M" | "H";
/** [level, question, answer] or [level, question, answer, follow-up]. */
export type QA = [Level, string, string] | [Level, string, string, string];
export type Ref = [kind: string, title: string, note: string, url: string];

/** A learning topic or a design case — designs add primer and deep. */
export interface Item {
  id: string; t: string; tag: string; sum: string; body: string;
  viz?: string; drill?: string; primer?: string; deep?: string;
  qa?: QA[]; refs?: Ref[];
  /* Long-form lesson fields (topic-writer schema); all optional so older topics still render. */
  why?: string; prod?: string; lab?: string;
  prereq?: [id: string, refresher: string][];
  myths?: [myth: string, reality: string][];
  recap?: string[];
  glossary?: [term: string, definition: string][];
}
export interface Pattern { k: string; n: string; when: string; cx: string; tpl: string; trap: string }
export interface Problem { id: string; t: string; p: string; d: Level; c: string; k: string }
export interface BankQ { id: string; cat: string; d: Level; q: string; a: string; src?: string; srcView?: string; srcTitle?: string }
export interface Week { w: number; t: string; focus: string; items: [string, string][] }
export type Draw =
  | { type: "dsa" }
  | { type: "bank"; cats: string[]; n: number }
  | { type: "design"; source: DesignKey; cat: string; hint: string; extra: number };
export interface Round { id: string; n: string; mins: number; d: string; draw: Draw }
export interface ViewText { kind: "track" | "design"; eyebrow: string; title: string; lede: string; note?: string }

const cast = <T,>(x: unknown) => x as T;

export const TRACKS = {
  ml: cast<Item[]>(ml), dl: cast<Item[]>(dl), llm: cast<Item[]>(llm),
  aieng: cast<Item[]>(aieng), ts: cast<Item[]>(ts),
  swe: cast<Item[]>(swe),
  gpu: cast<Item[]>(gpu),
  rs: cast<Item[]>(rs),
  mm: cast<Item[]>(mm),
  net: cast<Item[]>(net),
  scale: cast<Item[]>(scale),
  py: cast<Item[]>(py),
};
export type TrackKey = keyof typeof TRACKS;

export const DESIGNS = {
  classic: cast<Item[]>(classic), infra: cast<Item[]>(infra),
  hld: cast<Item[]>(hld), lld: cast<Item[]>(lld),
  mlc: cast<Item[]>(mlc),
};
export type DesignKey = keyof typeof DESIGNS;

export const PATTERNS = cast<Pattern[]>(patterns);
export const DSA = cast<Problem[]>(dsa);
export const PAT_NAME: Record<string, string> = Object.fromEntries(PATTERNS.map(p => [p.k, p.n]));
PAT_NAME.arr = PAT_NAME.arr || "Arrays & Prefix Sums";
export const ROADMAP = cast<Week[]>(roadmap);
export const ROUNDS = cast<Round[]>(rounds);
export const CATS: Record<string, string> = meta.cats;
export const BLURB: Record<string, string> = meta.blurb;
export const VIEWS = cast<Record<string, ViewText>>(views);

/* Quick checks on topics and designs also feed the question bank, flashcards and
   mock rounds. Which bank category each section's checks land in: */
const TRACK_CAT: Record<TrackKey, string> = { ml: "ml", dl: "dl", llm: "llm", aieng: "sys", ts: "ts", swe: "swe", gpu: "gpu", rs: "rs", mm: "mm", net: "net", scale: "scale", py: "py" };
const DESIGN_CAT: Record<DesignKey, string> = { hld: "sys", lld: "code", classic: "sys", infra: "sys", mlc: "mlc" };

function derived(): BankQ[] {
  const out: BankQ[] = [];
  const push = (list: Item[], view: string, cat: string) => list.forEach(it =>
    (it.qa || []).forEach((r, i) => out.push({
      id: `qa-${it.id}-${i + 1}`, cat, d: r[0], q: r[1], a: r[2], src: it.id, srcView: view, srcTitle: it.t,
    })));
  (Object.keys(TRACKS) as TrackKey[]).forEach(k => push(TRACKS[k], k, TRACK_CAT[k]));
  (Object.keys(DESIGNS) as DesignKey[]).forEach(k => push(DESIGNS[k], k, DESIGN_CAT[k]));
  return out;
}
/* Where each topic/design lives, so a prerequisite id can link to it. */
export const ITEM_INDEX: Record<string, { view: string; t: string }> = {};
(Object.keys(TRACKS) as TrackKey[]).forEach(k => TRACKS[k].forEach(x => { ITEM_INDEX[x.id] = { view: k, t: x.t }; }));
(Object.keys(DESIGNS) as DesignKey[]).forEach(k => DESIGNS[k].forEach(x => { ITEM_INDEX[x.id] = { view: k, t: x.t }; }));

export const BANK: BankQ[] = cast<BankQ[]>(bank).concat(derived());

/* Pillars on the overview: each groups the tracked ids of one area. */
export const PILLARS = [
  { k: "dsa", n: "DSA", view: "dsa", color: "var(--s1)", ids: DSA.map(q => q.id) },
  { k: "mlc", n: "ML coding", view: "mlc", color: "var(--s1)", ids: DESIGNS.mlc.map(t => t.id) },
  { k: "ml", n: "ML foundations", view: "ml", color: "var(--s3)", ids: TRACKS.ml.map(t => t.id) },
  { k: "dl", n: "Deep learning", view: "dl", color: "var(--s7)", ids: [...TRACKS.dl, ...TRACKS.gpu].map(t => t.id) },
  { k: "llm", n: "LLM & GenAI", view: "llm", color: "var(--s2)", ids: [...TRACKS.llm, ...TRACKS.aieng, ...TRACKS.mm, ...TRACKS.rs].map(t => t.id) },
  { k: "ts", n: "Time series", view: "ts", color: "var(--s6)", ids: TRACKS.ts.map(t => t.id) },
  { k: "eng", n: "Engineering", view: "swe", color: "var(--s8)", ids: [...TRACKS.swe, ...TRACKS.py, ...TRACKS.scale, ...TRACKS.net].map(t => t.id) },
  { k: "des", n: "System design", view: "classic", color: "var(--s4)",
    ids: [...DESIGNS.classic, ...DESIGNS.infra, ...DESIGNS.hld, ...DESIGNS.lld].map(t => t.id) },
  { k: "bank", n: "Question bank", view: "bank", color: "var(--s5)", ids: BANK.map(b => b.id) },
];
export const ROADMAP_IDS = ROADMAP.flatMap(w => w.items.map(i => i[0]));
export const ALL_IDS = PILLARS.flatMap(p => p.ids).concat(ROADMAP_IDS);

/* Sidebar. `v` is the route: /<v>. */
export interface NavItem { v: string; n: string; i: string; count?: number; deep?: number }

/** Share (0–1) of a track or design family rewritten as a long-form lesson (topic-writer schema). */
function deepShare(items: Item[]): number {
  return items.length ? items.filter(t => t.recap?.length && t.glossary?.length).length / items.length : 0;
}
export const NAV: { g: string; items: NavItem[] }[] = [
  { g: "Workspace", items: [
    { v: "overview", n: "Overview", i: "OV" },
    { v: "roadmap", n: "8-week plan", i: "RM", count: ROADMAP_IDS.length },
    { v: "mock", n: "Mock interview", i: "MI" },
    { v: "cards", n: "Flashcards", i: "FC", count: BANK.length },
    { v: "data", n: "Your data", i: "DB" } ] },
  { g: "Drill", items: [
    { v: "dsa", n: "DSA problems", i: "DS", count: DSA.length },
    { v: "mlc", n: "ML coding", i: "MC", count: DESIGNS.mlc.length },
    { v: "bank", n: "Question bank", i: "QB", count: BANK.length } ] },
  { g: "Learn", items: [
    { v: "ml", n: "ML foundations", i: "ML", count: TRACKS.ml.length },
    { v: "dl", n: "Deep learning", i: "DL", count: TRACKS.dl.length },
    { v: "llm", n: "LLM & GenAI", i: "LM", count: TRACKS.llm.length },
    { v: "aieng", n: "AI engineering", i: "AE", count: TRACKS.aieng.length },
    { v: "mm", n: "Multimodal AI", i: "MM", count: TRACKS.mm.length },
    { v: "rs", n: "Reasoning models", i: "RS", count: TRACKS.rs.length },
    { v: "gpu", n: "GPU performance", i: "GP", count: TRACKS.gpu.length },
    { v: "ts", n: "Time series & AI", i: "TS", count: TRACKS.ts.length } ] },
  { g: "Engineering", items: [
    { v: "swe", n: "Software engineering", i: "SE", count: TRACKS.swe.length },
    { v: "py", n: "Python", i: "PY", count: TRACKS.py.length },
    { v: "scale", n: "Engineering at scale", i: "SC", count: TRACKS.scale.length },
    { v: "net", n: "Networking", i: "NW", count: TRACKS.net.length } ] },
  { g: "Design", items: [
    { v: "classic", n: "Classic designs", i: "CD", count: DESIGNS.classic.length },
    { v: "infra", n: "Building blocks", i: "BB", count: DESIGNS.infra.length },
    { v: "hld", n: "AI system design", i: "HD", count: DESIGNS.hld.length },
    { v: "lld", n: "Machine coding", i: "LD", count: DESIGNS.lld.length } ] },
];
for (const it of NAV.flatMap(g => g.items)) {
  const items = it.v in TRACKS ? TRACKS[it.v as TrackKey] : it.v in DESIGNS ? DESIGNS[it.v as DesignKey] : null;
  if (items) it.deep = deepShare(items);
}
export const VIEW_TITLE: Record<string, string> = Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.v, i.n]));

/** Ids covered by a view, for the progress bars on the overview cards. */
export function idsForView(v: string): string[] | null {
  if (v in TRACKS) return TRACKS[v as TrackKey].map(t => t.id);
  if (v in DESIGNS) return DESIGNS[v as DesignKey].map(t => t.id);
  if (v === "dsa") return DSA.map(q => q.id);
  if (v === "bank") return BANK.map(b => b.id);
  if (v === "roadmap") return ROADMAP_IDS;
  return null;
}
