import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Collapsible } from "../components/Card";
import { StatusButtons, StatusChip } from "../components/Status";
import { BANK, CATS } from "../content";
import { useProgress } from "../store";
import { DIFF_CLS, DIFF_NAME, matches } from "../util";

export function Bank() {
  const { progressOf } = useProgress();
  const [params] = useSearchParams();
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const list = BANK.filter(b => (!cat || b.cat === cat) && matches(q, b.q, b.a));
  const g = progressOf(BANK.map(b => b.id));
  return (
    <div className="wrap">
      <div className="eyebrow">Drill · short answer</div>
      <h1 className="page-h">Question bank</h1>
      <p className="lede">{BANK.length} questions with the answer you would actually say out loud — two or three sentences, the mechanism named, no hedging. Open one, answer it in your head first, then check.</p>
      <div className="grid g4" style={{ margin: "20px 0 18px" }}>
        <div className="stat lead"><span className="k">Known</span><span className="v">{g.d}<small>/{g.n}</small></span><span className="d">{g.p}% of the bank</span></div>
        {["ml", "llm", "sys"].map(c => {
          const p = progressOf(BANK.filter(b => b.cat === c).map(b => b.id));
          return <div className="stat" key={c}><span className="k">{CATS[c]}</span><span className="v">{p.d}<small>/{p.n}</small></span><span className="d">{p.p}% known</span></div>;
        })}
      </div>
      <div className="filters">
        <label>Topic</label>
        <button className="pill-btn" type="button" aria-pressed={cat === ""} onClick={() => setCat("")}>All</button>
        {Object.keys(CATS).map(c => (
          <button key={c} className="pill-btn" type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {CATS[c]} <span style={{ opacity: 0.6 }}>{BANK.filter(b => b.cat === c).length}</span></button>
        ))}
        <input type="search" placeholder="Search questions…" value={q} onChange={e => setQ(e.target.value)} style={{ marginLeft: "auto" }} aria-label="Search questions" />
      </div>
      {list.length ? list.map((b, i) => (
        <Collapsible key={b.id} id={b.id} openId={params.get("open")} n={String(i + 1).padStart(3, "0")} title={b.q} titleStyle={{ fontSize: 15 }}
          meta={<><span className="tag">{CATS[b.cat]}</span><span className={`chip ${DIFF_CLS[b.d]}`}>{DIFF_NAME[b.d]}</span><StatusChip id={b.id} doneLabel="known" /></>}>
          <div className="prose"><p style={{ marginTop: 12 }}>{b.a}</p></div>
          <div className="fcontrols">
            <StatusButtons id={b.id} />
            {b.src && <Link className="btn ghost" to={`/${b.srcView}?open=${encodeURIComponent(b.src)}`} style={{ padding: "5px 11px", fontSize: 12.5 }}>
              Read the topic: {b.srcTitle}</Link>}
          </div>
        </Collapsible>
      )) : <div className="empty">No questions match that filter.</div>}
    </div>
  );
}
