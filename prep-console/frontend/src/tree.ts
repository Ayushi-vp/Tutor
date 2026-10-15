/* Tracks as trees. Every topic lists the topics it builds on (`prereq`); within a track
   those links form a tree (strictly, a graph without cycles), which gives each topic a
   stage and tells a learner what is unlocked next. Prerequisites in other tracks are
   kept as advice: they never lock a topic. */
import { DESIGNS, NAV, TRACKS, type DesignKey, type Item, type TrackKey } from "./content";
import type { Status } from "./store";

export type NodeState = "done" | "rev" | "ready" | "locked";
export interface TreeNode {
  id: string; t: string; tag: string; stage: number;
  pre: string[];                          // prerequisites in this track
  links: string[];                        // the ones to draw: `pre` without those already reached through another
  ext: { id: string; view: string }[];    // prerequisites in other tracks
  unlocks: string[];                      // topics in this track that build on this one
}
export interface Tree { view: string; name: string; nodes: Record<string, TreeNode>; stages: string[][] }

const ITEMS: Record<string, Item[]> = { ...TRACKS, ...DESIGNS } as Record<TrackKey | DesignKey, Item[]>;
const VIEW_OF: Record<string, string> = {};
for (const [v, list] of Object.entries(ITEMS)) for (const it of list) VIEW_OF[it.id] = v;

/** Views that have a tree, in sidebar order, with their sidebar names and groups. */
export const TREE_VIEWS: { v: string; n: string; g: string }[] = NAV.flatMap(g =>
  g.items.filter(i => i.v in ITEMS).map(i => ({ v: i.v, n: i.n, g: g.g })));

const cache: Record<string, Tree> = {};

export function treeOf(view: string): Tree {
  if (cache[view]) return cache[view];
  const list = ITEMS[view] || [];
  const order = Object.fromEntries(list.map((it, i) => [it.id, i]));
  const nodes: Record<string, TreeNode> = {};
  for (const it of list) {
    const all = (it.prereq || []).map(p => p[0]);
    nodes[it.id] = {
      id: it.id, t: it.t, tag: it.tag, stage: 0, unlocks: [], links: [],
      pre: all.filter(p => p in order && p !== it.id),
      ext: all.filter(p => !(p in order) && VIEW_OF[p]).map(p => ({ id: p, view: VIEW_OF[p] })),
    };
  }
  // Stage = the longest chain of prerequisites below a topic. A cycle (none today) is cut where it closes.
  const seen: Record<string, 1 | 2> = {};
  const stage = (id: string): number => {
    if (seen[id] === 2) return nodes[id].stage;
    if (seen[id] === 1) return -1;
    seen[id] = 1;
    let s = 0;
    nodes[id].pre = nodes[id].pre.filter(p => { const d = stage(p); if (d < 0) return false; s = Math.max(s, d + 1); return true; });
    seen[id] = 2;
    return (nodes[id].stage = s);
  };
  list.forEach(it => stage(it.id));
  for (const n of Object.values(nodes)) for (const p of n.pre) nodes[p].unlocks.push(n.id);
  // Lessons list both direct and earlier prerequisites; drawing all of them buries the shape of the
  // track, so a line is drawn only when no other prerequisite already leads back to it.
  const below: Record<string, Set<string>> = {};
  const ancestors = (id: string): Set<string> => {
    if (below[id]) return below[id];
    const out = new Set<string>();
    for (const p of nodes[id].pre) { out.add(p); ancestors(p).forEach(a => out.add(a)); }
    return (below[id] = out);
  };
  for (const n of Object.values(nodes)) n.links = n.pre.filter(p => !n.pre.some(q => q !== p && ancestors(q).has(p)));

  // Within a stage, sit each topic under the topics it builds on (one barycentre pass), so lines cross less.
  const stages: string[][] = [];
  for (const it of list) (stages[nodes[it.id].stage] ||= []).push(it.id);
  const pos: Record<string, number> = {};
  stages.forEach((row, s) => {
    if (s > 0) {
      const key = (id: string) => nodes[id].pre.length ? nodes[id].pre.reduce((a, p) => a + pos[p], 0) / nodes[id].pre.length : order[id];
      row.sort((a, b) => key(a) - key(b) || order[a] - order[b]);
    }
    row.forEach((id, i) => { pos[id] = row.length > 1 ? i / (row.length - 1) : 0.5; });
  });
  const name = TREE_VIEWS.find(x => x.v === view)?.n ?? view;
  return (cache[view] = { view, name, nodes, stages: stages.filter(Boolean) });
}

/** Studied: done, or flagged for a second pass. Either one meets a prerequisite. */
export const studied = (s: Status | null) => s === "done" || s === "rev";

export function stateOf(n: TreeNode, get: (id: string) => Status | null): NodeState {
  const s = get(n.id);
  if (s === "done") return "done";
  if (s === "rev") return "rev";
  return n.pre.every(p => studied(get(p))) ? "ready" : "locked";
}

export interface Step { id: string; t: string; view: string; track: string; why: string; score: number }

/** The best topics to learn next, across every track: finish what you started, prefer topics
    that unlock more, and spread the picks over more than one track. */
export function nextSteps(get: (id: string) => Status | null, limit = 3): Step[] {
  const started: Step[] = [], fresh: Step[] = [];
  for (const { v, n: track } of TREE_VIEWS) {
    const tree = treeOf(v);
    const all = Object.values(tree.nodes);
    const done = all.filter(x => get(x.id) === "done").length;
    for (const node of all) {
      if (stateOf(node, get) !== "ready") continue;
      const extLeft = node.ext.filter(e => !studied(get(e.id))).length;
      const unlocks = node.unlocks.length;
      let why: string;
      if (done) why = `Continue ${track} · ${done}/${all.length} done`;
      else why = `Start of ${track}`;
      if (unlocks) why += ` · unlocks ${unlocks} topic${unlocks === 1 ? "" : "s"}`;
      const score = (done ? 1000 + (100 * done) / all.length : 0) + unlocks * 6 - node.stage * 2 - extLeft * 4;
      (done ? started : fresh).push({ id: node.id, t: node.t, view: v, track, why, score });
    }
  }
  started.sort((a, b) => b.score - a.score);
  // A new learner starts at the root of each track in sidebar order rather than by score.
  const pool = started.length ? [...started, ...fresh.filter(f => treeOf(f.view).nodes[f.id].stage === 0)] : fresh.filter(f => treeOf(f.view).nodes[f.id].stage === 0);
  const out: Step[] = [], perTrack: Record<string, number> = {};
  for (const s of pool) {
    if ((perTrack[s.view] || 0) >= 2) continue;
    perTrack[s.view] = (perTrack[s.view] || 0) + 1;
    out.push(s);
    if (out.length === limit) break;
  }
  return out;
}

/** The track to show first: the started track closest to done, else the first one. */
export function defaultTreeView(get: (id: string) => Status | null): string {
  let best = TREE_VIEWS[0].v, bestShare = -1;
  for (const { v } of TREE_VIEWS) {
    const all = Object.keys(treeOf(v).nodes);
    const d = all.filter(id => get(id) === "done").length;
    if (d && d < all.length && d / all.length > bestShare) { best = v; bestShare = d / all.length; }
  }
  return best;
}

export function viewOfItem(id: string): string | undefined {
  return VIEW_OF[id];
}
