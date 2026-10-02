import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ItemCard } from "../components/Card";
import { ProgressBar } from "../components/Status";
import { DESIGNS, TRACKS, VIEWS, type DesignKey, type Item, type TrackKey } from "../content";
import { useProgress } from "../store";
import { matches } from "../util";

/** A learning track (ml, dl, llm, aieng, ts) or a design family (classic, infra, hld, lld). */
export function Section({ view }: { view: string }) {
  const { progressOf } = useProgress();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const text = VIEWS[view];
  const isDesign = view in DESIGNS;
  const list: Item[] = isDesign ? DESIGNS[view as DesignKey] : TRACKS[view as TrackKey];
  const g = progressOf(list.map(t => t.id));
  const shown = list.filter(t => matches(q, t.t, t.sum, t.body, t.primer, t.deep));

  return (
    <div className="wrap">
      <div className="eyebrow">{text.eyebrow}</div>
      <h1 className="page-h">{text.title}</h1>
      <p className="lede">{text.lede}</p>
      {text.note && <div className="callout" style={{ marginTop: 18 }}><b>How to run the round</b>{text.note}</div>}
      <div className="filters" style={{ marginTop: 20 }}>
        <label>{isDesign ? "Covered" : "Progress"}</label>
        <ProgressBar p={g.p} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)" }}>{g.d}/{g.n}{isDesign ? "" : " learned"}</span>
        <input type="search" placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} style={{ marginLeft: "auto" }} aria-label="Filter" />
      </div>
      {shown.length
        ? shown.map((t, i) => <ItemCard key={t.id} item={t} index={i} openId={params.get("open")} doneLabel={isDesign ? "done" : "learned"} noun={view === "mlc" ? "problem" : undefined} />)
        : <div className="empty">Nothing matches “{q}”.</div>}
    </div>
  );
}
