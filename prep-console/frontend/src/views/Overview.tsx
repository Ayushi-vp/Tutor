import { Link } from "react-router-dom";
import { BANK, BLURB, DSA, NAV, PILLARS, ALL_IDS, ROADMAP, idsForView } from "../content";
import { barsH, fig, heat, seqLegend, tableOf } from "../legacy/viz.js";
import { useProgress } from "../store";
import { todayKey } from "../util";

export function Overview() {
  const { state, progressOf, streak, get } = useProgress();
  const total = progressOf(ALL_IDS);
  const doneToday = state.days[todayKey()] || 0;
  const reviewCount = Object.values(state.items).filter(v => v === "rev").length;

  const pillars = PILLARS.map(p => ({ p, g: progressOf(p.ids) }));
  const maxN = Math.max(...pillars.map(x => x.g.n));
  const tickStep = maxN > 600 ? 200 : 100;
  const cover = fig({
    title: "Coverage by pillar",
    sub: "Everything tracked here. The bar behind each one is the full curriculum for that pillar.",
    body: barsH({ w: 660, rh: 28, labelW: 118, max: maxN, ticks: Array.from({ length: Math.floor(maxN / tickStep) + 1 }, (_, i) => i * tickStep),
      rows: pillars.map(({ p, g }) => ({ label: p.n, value: g.d, max: g.n, color: p.color, right: `${g.d}/${g.n}`, tip: `${g.p}% complete — ${g.n - g.d} left` })) }),
    table: tableOf(["Pillar", "Done", "Total", "%"], pillars.map(({ p, g }) => [p.n, g.d, g.n, g.p + "%"])),
  });

  // Twelve-week activity calendar, Monday-start.
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const back = (today.getDay() + 6) % 7;
  const end = new Date(today.getTime() + (6 - back) * 864e5);
  const days = Array.from({ length: 84 }, (_, i) => new Date(end.getTime() - (83 - i) * 864e5));
  const vals: number[][] = [], labels: string[][] = [];
  for (let r = 0; r < 7; r++) {
    vals.push([]); labels.push([]);
    for (let c = 0; c < 12; c++) { const k = days[c * 7 + r].toISOString().slice(0, 10); vals[r].push(state.days[k] || 0); labels[r].push(k); }
  }
  const months = Array.from({ length: 12 }, (_, c) => { const d = days[c * 7]; return c === 0 || d.getDate() <= 7 ? d.toLocaleString("en", { month: "short" }) : ""; });
  const cal = fig({
    title: "Consistency",
    sub: "One square per day for the last twelve weeks; darker means more items completed.",
    body: '<div class="calendar">' + heat({ cols: months, rows: ["Mon", "", "Wed", "", "Fri", "", "Sun"], values: vals, cell: 19, labelW: 34, topH: 18, zeroBlank: true,
      max: Math.max(4, ...vals.flat()), rx: 3,
      tip: (i: number, j: number, v: number) => `${labels[i][j]}~|~${v ? `${v} item${v === 1 ? "" : "s"} completed` : "nothing logged"}` })
      + "</div>" + seqLegend("none", "busy", "items/day"),
  });

  const next: { tag: string; t: string; s: string; v: string }[] = [];
  const wk = ROADMAP.find(w => w.items.some(i => get(i[0]) !== "done")) || ROADMAP[0];
  const step = wk.items.find(i => get(i[0]) !== "done");
  if (step) next.push({ tag: `Week ${wk.w}`, t: step[1], s: wk.focus, v: "roadmap" });
  if (reviewCount) next.push({ tag: "Review", t: `${reviewCount} item${reviewCount === 1 ? "" : "s"} flagged for a second pass`, s: "Clear these before adding new material", v: "dsa" });
  const weakest = [...pillars].sort((a, b) => a.g.p - b.g.p)[0];
  next.push({ tag: "Weakest", t: `${weakest.p.n} — ${weakest.g.p}% covered`, s: `${weakest.g.n - weakest.g.d} items left in this pillar`, v: weakest.p.view });
  next.push({ tag: "Drill", t: "Run a timed mock round", s: "Pressure exposes what reading never does", v: "mock" });

  return (
    <div className="wrap">
      <div className="eyebrow">Interview readiness</div>
      <h1 className="page-h">Where you stand today</h1>
      <p className="lede">A working surface for an AI-engineer loop: algorithms and ML coding, machine learning, LLM internals, multimodal and reasoning models, GPU performance, time series, engineering and system design. Mark things off as you go — progress is saved to your local database.</p>
      <div className="grid g4" style={{ marginTop: 20 }}>
        <div className="stat lead"><span className="k">Readiness</span><span className="v">{total.p}<small>%</small></span><span className="d">{total.d} of {total.n} items complete</span></div>
        <div className="stat"><span className="k">Streak</span><span className="v">{streak()}<small> d</small></span><span className="d">{doneToday ? `${doneToday} done today` : "nothing logged today"}</span></div>
        <div className="stat"><span className="k">Flagged for review</span><span className="v">{reviewCount}</span><span className="d">{reviewCount ? "clear these first" : "nothing outstanding"}</span></div>
        <div className="stat"><span className="k">Curriculum</span><span className="v">{total.n}</span><span className="d">{DSA.length} problems · {BANK.length} questions</span></div>
      </div>
      <div className="sec hero">
        <div dangerouslySetInnerHTML={{ __html: cover }} />
        <div className="card">
          <div className="card-t">Next up</div>
          <p className="card-s" style={{ marginBottom: 10 }}>Picked from your plan, your review flags and your thinnest pillar.</p>
          <div className="nextlist">{next.map(n => (
            <div className="nextrow" key={n.tag}>
              <span className="nx">{n.tag}</span><span><b>{n.t}</b><small>{n.s}</small></span>
              <Link className="go" to={`/${n.v}`}>Open</Link>
            </div>))}
          </div>
        </div>
      </div>
      <div className="sec" dangerouslySetInnerHTML={{ __html: cal }} />
      <div className="sec">
        <div className="rowh"><div><h2 className="sec-h">Start anywhere</h2><p className="sec-s">Each track stands on its own.</p></div></div>
        <div className="grid g3">
          {NAV.flatMap(g => g.items).filter(i => i.v !== "overview" && i.v !== "data").map(i => {
            const ids = idsForView(i.v);
            const g = ids ? progressOf(ids) : null;
            return (
              <Link className="card" to={`/${i.v}`} key={i.v} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card-t">{i.n}</div>
                <p className="card-s">{BLURB[i.v] || ""}</p>
                {g && <>
                  <div className="bar" style={{ marginTop: 11 }}><i style={{ width: `${g.p}%` }} /></div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)", marginTop: 5 }}>{g.d} / {g.n}</div>
                </>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
