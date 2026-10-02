import { Link, useSearchParams } from "react-router-dom";
import { BANK, CATS, DESIGNS, DSA, PATTERNS, PAT_NAME, TRACKS, VIEW_TITLE, type DesignKey, type TrackKey } from "../content";
import { matches } from "../util";

interface Hit { kind: string; view: string; title: string; sub: string; id: string }

export function searchAll(q: string): Hit[] {
  const out: Hit[] = [];
  DSA.forEach(d => { if (matches(q, d.t, PAT_NAME[d.p], d.k)) out.push({ kind: "Problem", view: "dsa", title: d.t, sub: `${PAT_NAME[d.p]} · ${d.k}`, id: `pat-${d.p}` }); });
  (Object.keys(TRACKS) as TrackKey[]).forEach(k => TRACKS[k].forEach(x => {
    if (matches(q, x.t, x.sum, x.body, x.primer, x.deep)) out.push({ kind: VIEW_TITLE[k], view: k, title: x.t, sub: x.sum, id: x.id });
  }));
  (Object.keys(DESIGNS) as DesignKey[]).forEach(k => DESIGNS[k].forEach(x => {
    if (matches(q, x.t, x.sum, x.body, x.primer, x.deep)) out.push({ kind: VIEW_TITLE[k], view: k, title: x.t, sub: x.sum, id: x.id });
  }));
  BANK.forEach(b => { if (matches(q, b.q, b.a)) out.push({ kind: `${CATS[b.cat]} question`, view: "bank", title: b.q, sub: b.a, id: b.id }); });
  PATTERNS.forEach(p => { if (matches(q, p.n, p.when)) out.push({ kind: "Pattern", view: "dsa", title: p.n, sub: p.when, id: `pat-${p.k}` }); });
  return out;
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const res = q.length >= 2 ? searchAll(q) : [];
  return (
    <div className="wrap">
      <div className="eyebrow">Search</div>
      <h1 className="page-h">{res.length} result{res.length === 1 ? "" : "s"} for “{q}”</h1>
      <p className="lede">Across problems, topics, designs and the question bank. Selecting a result opens it in place.</p>
      <div style={{ marginTop: 22 }}>
        {res.length ? res.slice(0, 60).map((r, i) => (
          <Link key={i} className="srch-hit" to={`/${r.view}?open=${encodeURIComponent(r.id)}`} style={{ textDecoration: "none", color: "inherit" }}>
            <span className="tag" style={{ float: "right", marginLeft: 10 }}>{r.kind}</span>
            <b><Highlight text={r.title} q={q} /></b>
            <small><Highlight text={r.sub.replace(/<[^>]+>/g, " ").slice(0, 170)} q={q} /></small>
          </Link>
        )) : <div className="empty">Nothing found. Try “attention”, “calibration”, “sliding window” or “stationarity”.</div>}
      </div>
    </div>
  );
}
