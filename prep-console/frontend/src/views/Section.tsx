import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ItemCard } from "../components/Card";
import { ProgressBar } from "../components/Status";
import { DESIGNS, TRACKS, VIEWS, type DesignKey, type Item, type TrackKey } from "../content";
import { lessonPath } from "../lesson";
import { useProgress } from "../store";
import { matches } from "../util";
import { fmt, milestoneOf, xpOf } from "../xp";

function QuestProgress({ p }: { p: number }) {
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="quest-ring" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle className="quest-ring-track" cx="50" cy="50" r="42" />
        <circle className="quest-ring-value" cx="50" cy="50" r="42"
          strokeDasharray={`${(p / 100) * circumference} ${circumference}`} />
      </svg>
      <span><b>{p}%</b><small>complete</small></span>
    </div>
  );
}

/** A learning track (ml, dl, llm, aieng, ts) or a design family (classic, infra, hld, lld). */
export function Section({ view }: { view: string }) {
  const { get, progressOf, streak } = useProgress();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const text = VIEWS[view];
  const isDesign = view in DESIGNS;
  const list: Item[] = isDesign ? DESIGNS[view as DesignKey] : TRACKS[view as TrackKey];
  const g = progressOf(list.map(t => t.id));
  const shown = list.filter(t => matches(q, t.t, t.sum, t.body, t.primer, t.deep));
  const reviewCount = list.filter(t => get(t.id) === "rev").length;
  const next = list.find(t => get(t.id) !== "done") || list[0];
  const sectionNoun = isDesign ? "designs" : "lessons";
  // Tracks weigh topics by difficulty; design families have no difficulty yet, so they count cases.
  const xp = xpOf(list.map(t => t.id), get);
  const hasXp = xp.available > 0;
  const ms = hasXp ? milestoneOf(xp.earned, xp.available) : milestoneOf(g.d, g.n);
  const nextLine = !ms.next ? "Every milestone reached"
    : ms.next.k === "first" ? `Complete any ${isDesign ? "case" : "topic"} to reach ${ms.next.n}`
    : `${hasXp ? `${fmt(ms.need)} XP` : `${ms.need} more`} to ${ms.next.n}`;

  return (
    <div className="reading-wrap">
      <section className="reading-hero" aria-labelledby="track-title">
        <div className="reading-intro">
          <div className="eyebrow">{text.eyebrow}</div>
          <h1 className="page-h" id="track-title">{text.title}</h1>
          <p className="lede">{text.lede}</p>
          {text.note && <div className="callout reading-note"><b>How to run the round</b>{text.note}</div>}
          {next && (
            <Link className="quest-continue" to={lessonPath(next.id)}>
              <span>{g.d === g.n ? "Revisit the trail" : g.d ? "Continue your quest" : "Start the first quest"}</span>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9h10M10 5l4 4-4 4" />
              </svg>
            </Link>
          )}
        </div>
        <aside className="quest-card" aria-label={`${text.title} progress`}>
          <div className="quest-card-top">
            <div>
              <span className="quest-kicker">Track milestone</span>
              <strong>{ms.reached?.n ?? "Not started"}</strong>
            </div>
            <QuestProgress p={hasXp ? xp.p : g.p} />
          </div>
          <div className="quest-stats">
            {hasXp
              ? <div><b>{fmt(xp.earned)}</b><span>of {fmt(xp.available)} XP</span></div>
              : <div><b>{g.d}</b><span>of {g.n} done</span></div>}
            <div><b>{Math.max(0, g.n - g.d)}</b><span>Quests left</span></div>
            <div><b>{streak()}</b><span>Day streak</span></div>
          </div>
          <div className="quest-next">
            <span className="quest-kicker">Next milestone</span>
            <span>{nextLine}</span>
          </div>
          <div className="quest-review">
            <span className="quest-review-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5V2l-2 2A5 5 0 1 0 13 8" />
              </svg>
            </span>
            <span>{reviewCount ? `${reviewCount} marked for another pass` : "Review queue is clear"}</span>
          </div>
        </aside>
      </section>

      <section className="quest-board" aria-labelledby="quest-board-title">
        <div className="quest-board-head">
          <div>
            <span className="quest-kicker">Learning path</span>
            <h2 id="quest-board-title">Quest map</h2>
            <p>{shown.length} of {list.length} {sectionNoun} visible</p>
          </div>
          <label className="quest-search">
            <span>Find a quest</span>
            <span className="quest-search-field">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" />
              </svg>
              <input type="search" placeholder="Search this path…" value={q} onChange={e => setQ(e.target.value)} />
            </span>
          </label>
        </div>
        <div className="quest-progress-row">
          <span>{isDesign ? "Covered" : "Progress"}</span>
          <ProgressBar p={g.p} />
          <strong>{g.d}/{g.n}{isDesign ? "" : " learned"}</strong>
        </div>
        <div className="quest-list">
          {shown.length
            ? shown.map((t, i) => <ItemCard key={t.id} item={t} index={i} openId={params.get("open")} doneLabel={isDesign ? "done" : "learned"} noun={view === "mlc" ? "problem" : undefined} />)
            : <div className="empty">Nothing matches “{q}”. Try a different keyword.</div>}
        </div>
      </section>
    </div>
  );
}
