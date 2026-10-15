/* Helpers for the focused lesson page (/<view>/<id>): where a lesson lives, how long it
   takes to read, and the names of its sections for the table of contents. */
import { DESIGNS, ITEM_INDEX, TRACKS, type DesignKey, type Item, type TrackKey } from "./content";

/** /<view>/<id> for a topic or design case, plus an optional "?pin=3"-style suffix. */
export function lessonPath(id: string, extra = ""): string {
  const at = ITEM_INDEX[id];
  return at ? `/${at.view}/${encodeURIComponent(id)}${extra}` : "/";
}

/** The ordered list a view's lessons come from, or null for views that are not tracks or design families. */
export function lessonsOf(view: string): Item[] | null {
  if (view in TRACKS) return TRACKS[view as TrackKey];
  if (view in DESIGNS) return DESIGNS[view as DesignKey];
  return null;
}

const WPM = 220;
const minutes = new Map<string, number>();
const words = (html?: string) => (html ? html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length : 0);

/** Estimated reading time in whole minutes, counting every section a reader sees. */
export function readingMinutes(it: Item): number {
  const hit = minutes.get(it.id);
  if (hit !== undefined) return hit;
  let n = [it.why, it.primer, it.body, it.deep, it.prod, it.lab, it.drill].reduce((s, h) => s + words(h), 0);
  n += (it.myths || []).reduce((s, [m, r]) => s + words(m) + words(r), 0);
  n += (it.recap || []).reduce((s, r) => s + words(r), 0);
  n += (it.glossary || []).reduce((s, [t, d]) => s + words(t) + words(d), 0);
  n += (it.qa || []).reduce((s, q) => s + words(q[1]) + words(q[2]), 0);
  const m = Math.max(1, Math.round(n / WPM));
  minutes.set(it.id, m);
  return m;
}

/** Table-of-contents labels for the data-toc keys that LessonBody puts on each section. */
export const TOC_LABEL: Record<string, string> = {
  why: "Why this exists", prereq: "Before you start", primer: "Start here", body: "The lesson",
  deep: "Going deeper", viz: "Figure", prod: "In production", myths: "Misconceptions", lab: "Hands-on lab",
  recap: "Recap", gloss: "Glossary", drill: "Exercise", checks: "Quick checks", refs: "Sources", notes: "My notes",
};
