/* One track as a tree: stages from top to bottom, a line from each topic to the topics
   that build on it. Topics are plain HTML that wraps on small screens; an SVG layer
   behind them draws the lines from measured positions. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { lessonPath } from "../lesson";
import { useProgress } from "../store";
import { TREE_VIEWS, defaultTreeView, stateOf, studied, treeOf, type NodeState } from "../tree";

const KEY = "apc.tree.view";
const ICON: Record<NodeState, string> = { done: "✓", rev: "↻", ready: "", locked: "" };
const STATE_LABEL: Record<NodeState, string> = { done: "done", rev: "flagged for review", ready: "ready to learn", locked: "locked" };

interface Line { from: string; to: string; d: string; cls: string }

export function SkillTree() {
  const { get } = useProgress();
  const [view, setView] = useState(() => {
    try { const v = localStorage.getItem(KEY); if (v && TREE_VIEWS.some(x => x.v === v)) return v; } catch { /* ignore */ }
    return defaultTreeView(get);
  });
  useEffect(() => { try { localStorage.setItem(KEY, view); } catch { /* ignore */ } }, [view]);
  const tree = treeOf(view);
  const nodes = Object.values(tree.nodes);
  const states = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, stateOf(n, get)])) as Record<string, NodeState>, [tree, get]);
  const count = (s: NodeState) => nodes.filter(n => states[n.id] === s).length;
  const ready = nodes.filter(n => states[n.id] === "ready");
  const next = ready.sort((a, b) => b.unlocks.length - a.unlocks.length || a.stage - b.stage)[0]?.id;

  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focus, setFocus] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const at: Record<string, DOMRect> = {};
      el.querySelectorAll<HTMLElement>("[data-node]").forEach(n => { at[n.dataset.node!] = n.getBoundingClientRect(); });
      const out: Line[] = [];
      for (const n of nodes) {
        const c = at[n.id];
        if (!c) continue;
        for (const p of n.links) {
          const a = at[p];
          if (!a) continue;
          const x1 = a.left + a.width / 2 - b.left, y1 = a.bottom - b.top;
          const x2 = c.left + c.width / 2 - b.left, y2 = c.top - b.top;
          const dy = Math.max(18, (y2 - y1) / 2);
          // Blue only where it leads somewhere you can go now; green along the path already walked.
          const st = states[n.id];
          const met = states[p] === "done" || states[p] === "rev";
          const cls = st === "ready" ? "open" : st === "done" || st === "rev" ? "done" : met ? "met" : "locked";
          out.push({ from: p, to: n.id, cls, d: `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${(y1 + dy).toFixed(1)} ${x2.toFixed(1)} ${(y2 - dy).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}` });
        }
      }
      setLines(out);
      setSize({ w: b.width, h: b.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tree, states]);

  // Hovering or focusing a topic lights up everything it needs and everything it leads to.
  const related = useMemo(() => {
    if (!focus) return null;
    const out = new Set([focus]);
    const up = (id: string) => tree.nodes[id].pre.forEach(p => { if (!out.has(p)) { out.add(p); up(p); } });
    const down = (id: string) => tree.nodes[id].unlocks.forEach(u => { if (!out.has(u)) { out.add(u); down(u); } });
    up(focus); down(focus);
    return out;
  }, [focus, tree]);

  const done = count("done");
  return (
    <div className="stree">
      <div className="stree-top">
        <label className="stree-pick">
          <span>Track</span>
          <select value={view} onChange={e => { setView(e.target.value); setFocus(null); }} aria-label="Track to show as a tree">
            {[...new Set(TREE_VIEWS.map(x => x.g))].map(g => (
              <optgroup key={g} label={g}>
                {TREE_VIEWS.filter(x => x.g === g).map(x => {
                  const all = Object.keys(treeOf(x.v).nodes);
                  return <option key={x.v} value={x.v}>{x.n} — {all.filter(id => get(id) === "done").length}/{all.length}</option>;
                })}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="stree-sum">
          <span><b>{done}</b>/{nodes.length} done</span>
          <span className="s-ready"><b>{ready.length}</b> ready</span>
          {count("rev") > 0 && <span className="s-rev"><b>{count("rev")}</b> to review</span>}
          <span className="s-locked"><b>{count("locked")}</b> locked</span>
          <Link to={`/${view}`} className="stree-open">Open track →</Link>
        </div>
      </div>
      <div className="bar stree-bar"><i style={{ width: `${nodes.length ? (100 * done) / nodes.length : 0}%` }} /></div>

      <div className={`stree-map${related ? " focusing" : ""}`} ref={box} onMouseLeave={() => setFocus(null)}>
        <svg className="stree-lines" width={size.w} height={size.h} aria-hidden="true">
          {lines.map(l => <path key={`${l.from}>${l.to}`} d={l.d} className={`${l.cls}${related && related.has(l.from) && related.has(l.to) ? " rel" : ""}`} />)}
        </svg>
        {tree.stages.map((row, s) => (
          <div className="stree-stage" key={s}>
            <div className="stree-sl">Stage {s + 1}</div>
            <div className="stree-row">
              {row.map(id => {
                const n = tree.nodes[id], st = states[id];
                const extLeft = n.ext.filter(e => !studied(get(e.id)));
                const tip = [n.t, STATE_LABEL[st],
                  n.pre.length ? `Builds on: ${n.pre.map(p => tree.nodes[p].t).join("; ")}` : "No prerequisites in this track",
                  extLeft.length ? `Also uses ${extLeft.length} topic${extLeft.length === 1 ? "" : "s"} from other tracks` : "",
                  n.unlocks.length ? `Unlocks ${n.unlocks.length}` : ""].filter(Boolean).join("\n");
                return (
                  <Link key={id} data-node={id} to={lessonPath(id)} title={tip}
                    className={`snode ${st}${id === next ? " next" : ""}${related ? (related.has(id) ? " rel" : " dim") : ""}`}
                    aria-label={`${n.t} — ${STATE_LABEL[st]}`}
                    onMouseEnter={() => setFocus(id)} onFocus={() => setFocus(id)} onBlur={() => setFocus(null)}>
                    {id === next && <span className="snode-next">Next</span>}
                    <span className="snode-i" aria-hidden="true">{ICON[st]}</span>
                    <span className="snode-t">{n.t}</span>
                    {extLeft.length > 0 && st !== "done" && <span className="snode-ext" aria-hidden="true">+{extLeft.length}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="stree-legend" aria-hidden="true">
        <span><i className="lg done" />Done</span><span><i className="lg ready" />Ready — its prerequisites are done</span>
        <span><i className="lg rev" />Flagged for review</span><span><i className="lg locked" />Locked</span>
        <span><b className="snode-ext">+1</b>also uses topics from other tracks</span>
      </div>
    </div>
  );
}
