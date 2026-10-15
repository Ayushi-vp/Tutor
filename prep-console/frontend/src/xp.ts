/* Topic XP. Every learning topic carries a difficulty (content/tracks/*.json), and completing it is
   worth points by that difficulty. XP is computed from the saved statuses rather than stored, so a
   repeated click, an undo, an import or a reset can never leave it out of step with progress. */
import { ITEM_INDEX, TRACKS, type Item, type Level, type TrackKey } from "./content";
import type { Status } from "./store";
import { DIFF_NAME } from "./util";

export const XP: Record<Level, number> = { E: 50, M: 100, H: 200 };

/** XP for each learning topic id. Design cases, DSA problems and bank questions earn none yet. */
export const TOPIC_XP: Record<string, number> = {};
for (const list of Object.values(TRACKS)) for (const t of list) if (t.difficulty) TOPIC_XP[t.id] = XP[t.difficulty];
export const TOPIC_IDS = Object.keys(TOPIC_XP);

export const xpLabel = (d: Level) => `${DIFF_NAME[d]} · ${XP[d]} XP`;
export const fmt = (n: number) => n.toLocaleString("en");

export interface XpTally { earned: number; available: number; p: number }

export function xpOf(ids: string[], get: (id: string) => Status | null): XpTally {
  let earned = 0, available = 0;
  for (const id of ids) {
    const xp = TOPIC_XP[id];
    if (!xp) continue;
    available += xp;
    if (get(id) === "done") earned += xp;
  }
  return { earned, available, p: available ? Math.round((100 * earned) / available) : 0 };
}

/** Completion milestones within one track, by share of its available XP. They record progress
    through the material, not mastery: marking a topic done is the only evidence behind them. */
export const MILESTONES = [
  { k: "first", n: "First step", share: 0 },
  { k: "quarter", n: "Quarter way", share: 0.25 },
  { k: "half", n: "Halfway", share: 0.5 },
  { k: "complete", n: "Track complete", share: 1 },
] as const;
export type Milestone = (typeof MILESTONES)[number];

const target = (m: Milestone, available: number) => (m.share ? Math.ceil(m.share * available) : 1);

/** The milestone reached and the next one, for `earned` out of `available` (XP, or item counts). */
export function milestoneOf(earned: number, available: number): { reached: Milestone | null; next: Milestone | null; need: number } {
  let reached: Milestone | null = null;
  for (const m of MILESTONES) if (available && earned >= target(m, available)) reached = m;
  const next = MILESTONES.find(m => !available || earned < target(m, available)) ?? null;
  return { reached, next, need: next && available ? target(next, available) - earned : 0 };
}

export interface TrackGoal { view: TrackKey; milestone: Milestone; need: number }

/** Across started tracks, the next milestone that is closest to reach. */
export function nearestMilestone(get: (id: string) => Status | null): TrackGoal | null {
  let best: TrackGoal | null = null;
  for (const [view, list] of Object.entries(TRACKS) as [TrackKey, Item[]][]) {
    const g = xpOf(list.map(t => t.id), get);
    if (!g.earned) continue;
    const { next, need } = milestoneOf(g.earned, g.available);
    if (next && (!best || need < best.need)) best = { view, milestone: next, need };
  }
  return best;
}

/* The completion toast. The store announces a topic newly marked done; XpToast shows it. */
export const XP_EVENT = "apc:xp";
export interface XpGain { id: string; xp: number; title: string }

export function announceXp(id: string): void {
  const xp = TOPIC_XP[id];
  if (!xp || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<XpGain>(XP_EVENT, { detail: { id, xp, title: ITEM_INDEX[id]?.t ?? id } }));
}
