/* One topic or design case as a page of its own: /<view>/<id>.
   A sticky table of contents (built from the sections and their headings), a reading
   progress bar, previous / next lesson, and the scroll position remembered per lesson. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AskTutorButton, LessonBody, XpChip } from "../components/Card";
import { StatusButtons, StatusChip } from "../components/Status";
import { DESIGNS, VIEWS, VIEW_TITLE, type Item } from "../content";
import { lessonPath, lessonsOf, readingMinutes, TOC_LABEL } from "../lesson";
import { useProgress } from "../store";
import { TOPIC_XP } from "../xp";

export function LessonRoute() {
  const { view = "", id = "" } = useParams();
  const list = lessonsOf(view);
  if (!list) return <Navigate to="/" replace />;
  const index = list.findIndex(t => t.id === id);
  if (index < 0) return <Navigate to={`/${view}`} replace />;
  return <Lesson key={id} view={view} list={list} index={index} />;
}

/* Where each lesson was left, as a share of the page height so it survives a text-size change.
   One small map in localStorage, newest last, capped. */
const POS_KEY = "apc.pos";
const POS_MAX = 60;
function readPos(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || "{}"); } catch { return {}; }
}
function savePos(id: string) {
  try {
    const m = readPos();
    delete m[id];
    if (window.scrollY > 400) m[id] = +(window.scrollY / document.documentElement.scrollHeight).toFixed(4);
    const keys = Object.keys(m);
    for (const k of keys.slice(0, Math.max(0, keys.length - POS_MAX))) delete m[k];
    localStorage.setItem(POS_KEY, JSON.stringify(m));
  } catch { /* private mode */ }
}

interface Head { id: string; label: string; sub: boolean; parent: string }
/** Sections whose own headings are listed under them in the contents. */
const WITH_HEADINGS = new Set(["primer", "body", "deep", "prod", "lab"]);

/** Top-level sections always; the headings inside a section only while you are reading it. */
function Toc({ heads, active, onGo }: { heads: Head[]; active: string; onGo(id: string): void }) {
  const cur = heads.find(h => h.id === active);
  const open = cur ? (cur.sub ? cur.parent : cur.id) : "";
  return (
    <ol className="toc">
      {heads.filter(h => !h.sub || h.parent === open).map(h => (
        <li key={h.id} className={`${h.sub ? "sub" : ""}${h.id === active ? " on" : ""}`}>
          <a href={`#${h.id}`} aria-current={h.id === active ? "location" : undefined}
            onClick={e => { e.preventDefault(); onGo(h.id); }}>{h.label}</a>
        </li>
      ))}
    </ol>
  );
}

function Lesson({ view, list, index }: { view: string; list: Item[]; index: number }) {
  const item = list[index];
  const prev = list[index - 1], next = list[index + 1];
  const { get, setStatus } = useProgress();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const article = useRef<HTMLElement>(null);
  const mobileToc = useRef<HTMLDetailsElement>(null);
  const [heads, setHeads] = useState<Head[]>([]);
  const headsRef = useRef(heads);
  headsRef.current = heads;
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const [resumed, setResumed] = useState(false);
  const isDesign = view in DESIGNS;
  const mins = readingMinutes(item);
  const done = get(item.id) === "done";
  const doneWord = isDesign ? "done" : "learned";

  // The contents come from the rendered lesson: every [data-toc] section, plus the headings inside the long ones.
  useLayoutEffect(() => {
    const root = article.current;
    if (!root) return;
    const out: Head[] = [];
    root.querySelectorAll<HTMLElement>("[data-toc]").forEach(sec => {
      const key = sec.dataset.toc!;
      if (!TOC_LABEL[key]) return;
      if (!sec.id) sec.id = `sec-${key}`;
      out.push({ id: sec.id, label: TOC_LABEL[key], sub: false, parent: "" });
      if (!WITH_HEADINGS.has(key)) return;
      sec.querySelectorAll<HTMLElement>("h4").forEach((h, i) => {
        if (h.closest("details, .pin-slot")) return;
        if (!h.id) h.id = `${sec.id}-${i + 1}`;
        const label = h.textContent?.trim();
        if (label) out.push({ id: h.id, label, sub: true, parent: sec.id });
      });
    });
    setHeads(out);
  }, [item.id]);

  // Progress, the active heading, and the saved position all follow the scroll.
  useEffect(() => {
    let raf = 0, saveT = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = article.current;
        if (!root) return;
        const r = root.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setProgress(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1);
        let cur = "";
        for (const h of headsRef.current) {
          const el = document.getElementById(h.id);
          if (!el) continue;
          if (el.getBoundingClientRect().top < 140) cur = h.id; else break;
        }
        setActive(cur);
      });
      window.clearTimeout(saveT);
      saveT = window.setTimeout(() => savePos(item.id), 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); window.clearTimeout(saveT); };
  }, [item.id, heads]);

  // Reopen where the reader left off — after the layout's own scroll-to-top on navigation.
  // A ?pin= link scrolls to its passage instead.
  useEffect(() => {
    if (params.get("pin")) return;
    const f = readPos()[item.id];
    if (!f) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => { window.scrollTo(0, f * document.documentElement.scrollHeight); setResumed(true); });
    });
    return () => cancelAnimationFrame(raf);
  }, [item.id]);
  useEffect(() => {
    if (!resumed) return;
    const t = window.setTimeout(() => setResumed(false), 7000);
    return () => window.clearTimeout(t);
  }, [resumed]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (mobileToc.current) mobileToc.current.open = false;
  };
  const finish = () => {
    setStatus(item.id, "done");
    nav(next ? lessonPath(next.id) : `/${view}`);
  };
  const pct = Math.round(progress * 100);
  const left = Math.ceil(mins * (1 - progress));
  const trackTitle = VIEW_TITLE[view] || VIEWS[view]?.title || view;

  return (
    <div className="lesson-wrap">
      <div className="lprog" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="lesson-main">
        <header className="lhead">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to={`/${view}`}>{trackTitle}</Link>
            <span aria-hidden="true">/</span>
            <span>{isDesign ? "Case" : "Lesson"} {index + 1} of {list.length}</span>
          </nav>
          <h1 className="page-h">{item.t}</h1>
          <p className="lede">{item.sum}</p>
          <div className="lmeta">
            <span className="tag">{item.tag}</span>
            <XpChip item={item} />
            <span className="chip">{mins} min read</span>
            {item.qa && <span className="tag">{item.qa.length} checks</span>}
            <StatusChip id={item.id} doneLabel={doneWord} />
            <span className="lmeta-acts"><StatusButtons id={item.id} /><AskTutorButton item={item} /></span>
          </div>
        </header>
        <details className="ltoc-m" ref={mobileToc}>
          <summary>On this page <span>{pct}% read</span></summary>
          <Toc heads={heads} active={active} onGo={go} />
        </details>
        <article ref={article} id={item.id} className="topic lesson-doc" data-open="1">
          <div className="topic-b"><LessonBody item={item} /></div>
        </article>
        <div className="lfinish">
          {!done
            ? <button type="button" className="btn" onClick={finish}>Mark {doneWord} and {next ? "continue" : "finish the track"} →
                {TOPIC_XP[item.id] && <span className="lfinish-xp">+{TOPIC_XP[item.id]} XP</span>}</button>
            : next && <Link className="btn" to={lessonPath(next.id)}>Next {isDesign ? "case" : "lesson"} →</Link>}
          <span className="lfinish-st"><StatusButtons id={item.id} /></span>
        </div>
        <nav className="lnext" aria-label="More lessons">
          {prev
            ? <Link className="lnext-card" to={lessonPath(prev.id)}><small>← Previous</small><b>{prev.t}</b></Link>
            : <Link className="lnext-card" to={`/${view}`}><small>← Back</small><b>{trackTitle}</b></Link>}
          {next
            ? <Link className="lnext-card nx" to={lessonPath(next.id)}><small>Next →</small><b>{next.t}</b></Link>
            : <Link className="lnext-card nx" to={`/${view}`}><small>End of track</small><b>Back to {trackTitle}</b></Link>}
        </nav>
      </div>
      <aside className="ltoc" aria-label="On this page">
        <div className="ltoc-h"><span>On this page</span><small>{pct >= 99 ? "Finished" : `${left} min left`}</small></div>
        <Toc heads={heads} active={active} onGo={go} />
      </aside>
      {resumed && (
        <div className="lresume" role="status">
          <span>Picked up where you left off</span>
          <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setResumed(false); }}>Start from the top</button>
          <button type="button" className="x" aria-label="Dismiss" onClick={() => setResumed(false)}>×</button>
        </div>
      )}
    </div>
  );
}
