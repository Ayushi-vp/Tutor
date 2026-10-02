import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Collapsible } from "../components/Card";
import { StatusButtons } from "../components/Status";
import { DSA, PATTERNS, PAT_NAME, type Level } from "../content";
import { useProgress } from "../store";
import { DIFF_CLS, DIFF_NAME, matches } from "../util";

export function Dsa() {
  const { progressOf, get } = useProgress();
  const [params] = useSearchParams();
  const [pat, setPat] = useState("");
  const [diff, setDiff] = useState<"" | Level>("");
  const [stat, setStat] = useState("");
  const [q, setQ] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const list = DSA.filter(p =>
    (!pat || p.p === pat) && (!diff || p.d === diff) &&
    (!stat || (stat === "todo" ? !get(p.id) : get(p.id) === stat)) &&
    matches(q, p.t, PAT_NAME[p.p], p.c, p.k));
  const g = progressOf(DSA.map(p => p.id));
  const byDiff = (d: Level) => progressOf(DSA.filter(p => p.d === d).map(p => p.id));
  const clear = () => { setPat(""); setDiff(""); setStat(""); setQ(""); };

  return (
    <div className="wrap">
      <div className="eyebrow">Drill · algorithms</div>
      <h1 className="page-h">Patterns first, then problems</h1>
      <p className="lede">Problems are grouped by the pattern that unlocks them, because that is how they are recognised under time pressure. Learn the twenty-one patterns and most of the list becomes recall rather than invention.</p>
      <div className="grid g4" style={{ margin: "20px 0" }}>
        <div className="stat lead"><span className="k">Solved</span><span className="v">{g.d}<small>/{g.n}</small></span><span className="d">{g.p}% of the list</span></div>
        {(["E", "M", "H"] as Level[]).map(d => (
          <div className="stat" key={d}><span className="k">{DIFF_NAME[d]}</span><span className="v">{byDiff(d).d}<small>/{byDiff(d).n}</small></span>
            <span className="d">{{ E: "warm-ups and fundamentals", M: "the bulk of real screens", H: "senior loops and tie-breakers" }[d]}</span></div>
        ))}
      </div>

      <h2 className="sec-h">The twenty-one patterns</h2>
      <p className="sec-s">Each one: when it applies, the template to write from memory, and the mistake that costs the offer.</p>
      {PATTERNS.map((p, i) => {
        const n = DSA.filter(x => x.p === p.k).length;
        return (
          <Collapsible key={p.k} id={`pat-${p.k}`} openId={params.get("open")} n={String(i + 1).padStart(2, "0")} title={p.n} sub={p.when}
            meta={<><span className="tag">{n} problems</span><span className="chip">{p.cx}</span></>}>
            <div className="prose">
              <h4>Template</h4><pre>{p.tpl}</pre>
              <div className="callout warnc"><b>What goes wrong</b>{p.trap}</div>
              <button className="btn ghost" type="button" onClick={() => { setPat(p.k); tableRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
                Show the {n} problems</button>
            </div>
          </Collapsible>
        );
      })}

      <div className="sec" ref={tableRef}>
        <div className="rowh"><div><h2 className="sec-h">The problem list</h2>
          <p className="sec-s">Showing {list.length} of {DSA.length}. Use ↻ to flag anything you want to revisit and ✓ when you can solve it cold.</p></div></div>
        <div className="filters">
          <label htmlFor="f-pat">Pattern</label>
          <select id="f-pat" value={pat} onChange={e => setPat(e.target.value)}>
            <option value="">All patterns</option>
            {PATTERNS.map(p => <option key={p.k} value={p.k}>{p.n}</option>)}
          </select>
          <div className="seg">{([["", "All"], ["E", "Easy"], ["M", "Medium"], ["H", "Hard"]] as const).map(([v, l]) =>
            <button key={v} type="button" aria-pressed={diff === v} onClick={() => setDiff(v)}>{l}</button>)}</div>
          <div className="seg">{([["", "Any"], ["todo", "To do"], ["rev", "Review"], ["done", "Done"]] as const).map(([v, l]) =>
            <button key={v} type="button" aria-pressed={stat === v} onClick={() => setStat(v)}>{l}</button>)}</div>
          <input type="search" placeholder="Filter problems…" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter problems" />
        </div>
        {list.length ? (
          <div className="tscroll"><table>
            <thead><tr><th className="num">#</th><th>Problem</th><th>Pattern</th><th>Level</th><th>Seen at</th><th>Status</th></tr></thead>
            <tbody>{list.map((p, i) => (
              <tr key={p.id} className={get(p.id) === "done" ? "done" : ""}>
                <td className="num">{i + 1}</td>
                <td><span className="qt">{p.t}</span><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{p.k}</div></td>
                <td><span className="tag">{PAT_NAME[p.p]}</span></td>
                <td><span className={`chip ${DIFF_CLS[p.d]}`}>{DIFF_NAME[p.d]}</span></td>
                <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{p.c}</td>
                <td><StatusButtons id={p.id} /></td>
              </tr>))}
            </tbody></table></div>
        ) : (
          <div className="empty">No problems match those filters. <button className="btn ghost" type="button" onClick={clear} style={{ marginLeft: 8 }}>Clear filters</button></div>
        )}
      </div>
    </div>
  );
}
