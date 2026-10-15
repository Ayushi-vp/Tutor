import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { lessonPath, readingMinutes } from "../lesson";
import { ITEM_INDEX, type Item, type QA, type Ref } from "../content";
import { useProgress, type Status } from "../store";
import { usePins } from "../pins";
import { useTutor } from "../tutor";
import { PinLayer } from "./Pins";
import { DIFF_CLS, DIFF_NAME } from "../util";
import { StatusButtons, StatusChip } from "./Status";
import { Html, Viz } from "./Viz";
import { xpLabel } from "../xp";

/** "Medium · 100 XP", coloured by difficulty; nothing for items without one. */
export function XpChip({ item }: { item: Item }) {
  if (!item.difficulty) return null;
  return <span className={`chip ${DIFF_CLS[item.difficulty]}`} title="Difficulty and the XP for completing it">{xpLabel(item.difficulty)}</span>;
}

const Caret = () => (
  <svg className="caret" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2l4 4-4 4" /></svg>
);

/** The collapsible row used by topics, designs, patterns and bank questions. */
export function Collapsible({ id, n, title, sub, meta, children, openId, titleStyle, state }: {
  id: string; n: string; title: string; sub?: string; meta?: ReactNode; children: ReactNode;
  openId?: string | null; titleStyle?: React.CSSProperties; state?: Status | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Deep links (?open=<id>) open and scroll to the matching card.
  useEffect(() => {
    if (openId !== id) return;
    setOpen(true);
    const el = ref.current;
    requestAnimationFrame(() => {
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (el) { el.style.boxShadow = "0 0 0 2px var(--accent)"; setTimeout(() => { el.style.boxShadow = ""; }, 1400); }
    });
  }, [openId, id]);
  return (
    <div id={id} className={`topic${state ? ` topic-${state}` : ""}`} data-open={open ? "1" : "0"} ref={ref}>
      <button className="topic-h" type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="topic-n">{n}</span>
        <span style={{ minWidth: 0 }}>
          <span className="topic-tt" style={titleStyle}>{title}</span>
          {sub && <span className="topic-sm">{sub}</span>}
        </span>
        <span className="topic-meta">{meta}<Caret /></span>
      </button>
      {open && <div className="topic-b">{children}</div>}
    </div>
  );
}

export function QuickChecks({ qa }: { qa?: QA[] }) {
  if (!qa?.length) return null;
  return (
    <div className="checks" data-toc="checks">
      <div className="checks-h">Quick checks — {qa.length} follow-up{qa.length === 1 ? "" : "s"} an interviewer would ask next</div>
      {qa.map((r, i) => (
        <details className="qcheck" key={i}>
          <summary><span className={`chip ${DIFF_CLS[r[0]]}`}>{DIFF_NAME[r[0]]}</span><span>{r[1]}</span></summary>
          <p>{r[2]}</p>
          {r[3] && <p className="qfollow"><b>Follow-up</b>{r[3].replace(/^Follow-up:\s*/i, "")}</p>}
        </details>
      ))}
    </div>
  );
}

export function Refs({ refs }: { refs?: Ref[] }) {
  if (!refs?.length) return null;
  return (
    <div className="refs" data-toc="refs">
      <div className="refs-h">Go deeper — {refs.length} source{refs.length === 1 ? "" : "s"}</div>
      {refs.map((r, i) => {
        const host = r[3].replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
        return (
          <a className="ref" href={r[3]} target="_blank" rel="noopener noreferrer" title={r[3]} key={i}>
            <span className={`ref-k k-${r[0]}`}>{r[0]}</span>
            <span className="ref-b"><b>{r[1]}</b><small>{r[2]}</small></span>
            <span className="ref-h">{host} ↗</span>
          </a>
        );
      })}
    </div>
  );
}

/** "Before you start": each prerequisite links to the card that teaches it. */
function Prereqs({ list }: { list?: Item["prereq"] }) {
  if (!list?.length) return null;
  return (
    <div className="prereq" data-toc="prereq">
      <ul>
        {list.map(([id, note]) => {
          const at = ITEM_INDEX[id];
          return (
            <li key={id}>
              {at ? <Link to={lessonPath(id)}>{at.t}</Link> : <b>{id}</b>}
              <span> — {note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Myths({ list }: { list?: Item["myths"] }) {
  if (!list?.length) return null;
  return (
    <div className="myths" data-toc="myths">
      {list.map(([m, r], i) => (
        <div className="myth" key={i}>
          <div className="myth-m"><span className="chip hard">myth</span><span dangerouslySetInnerHTML={{ __html: m }} /></div>
          <div className="myth-r"><span className="chip easy">reality</span><span dangerouslySetInnerHTML={{ __html: r }} /></div>
        </div>
      ))}
    </div>
  );
}

function Recap({ list }: { list?: string[] }) {
  if (!list?.length) return null;
  return <div className="recap" data-toc="recap"><ol>{list.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: s }} />)}</ol></div>;
}

function Glossary({ list }: { list?: Item["glossary"] }) {
  if (!list?.length) return null;
  return (
    <details className="gloss" data-toc="gloss">
      <summary>Glossary — {list.length} term{list.length === 1 ? "" : "s"}</summary>
      <dl>{list.map(([t, d], i) => <div key={i}><dt>{t}</dt><dd dangerouslySetInnerHTML={{ __html: d }} /></div>)}</dl>
    </details>
  );
}

/** Your own notes on a topic. Tutor answers can be added here from the chat. */
function MyNotes({ id }: { id: string }) {
  const { state, setNote } = useProgress();
  const saved = state.notes[id] || "";
  const [text, setText] = useState(saved);
  const [open, setOpen] = useState(!!saved);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(saved);
    if (saved) setOpen(true);
  }, [saved]);
  const save = () => { editing.current = false; if (text.trim() !== saved) setNote(id, text); };
  return (
    <details className="mynotes" data-toc="notes" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>My notes{saved ? "" : " — add your own, or save a tutor answer here"}</summary>
      <textarea value={text} rows={Math.min(14, Math.max(3, text.split("\n").length + 1))} aria-label="My notes"
        placeholder="Write what you want to remember about this topic…"
        onFocus={() => { editing.current = true; }} onChange={e => setText(e.target.value)} onBlur={save} />
    </details>
  );
}

/** A full topic or design case, in reading order: why → prerequisites → primer → body → senior layer →
    figure → production → myths → lab → recap → glossary → exercise → checks → sources → notes.
    Every section is optional, so older, shorter topics render unchanged. Each carries a data-toc key
    that the lesson page's table of contents reads. Used inline in a track and on the lesson page. */
export function LessonBody({ item }: { item: Item }) {
  return <>
    {item.why && <div className="why" data-toc="why"><Html html={item.why} /></div>}
    <Prereqs list={item.prereq} />
    {item.primer && <div className="primer" data-toc="primer"><Html html={item.primer} /></div>}
    <Html html={item.body} toc="body" />
    {item.deep && <div className="deep" data-toc="deep"><Html html={item.deep} /></div>}
    {item.viz && <Viz name={item.viz} />}
    {item.prod && <div className="prod" data-toc="prod"><Html html={item.prod} /></div>}
    <Myths list={item.myths} />
    {item.lab && <div className="lab" data-toc="lab"><Html html={item.lab} /></div>}
    <Recap list={item.recap} />
    <Glossary list={item.glossary} />
    {item.drill && <Html className="drill" html={item.drill} toc="drill" />}
    <QuickChecks qa={item.qa} />
    <Refs refs={item.refs} />
    <PinLayer itemId={item.id} />
    <MyNotes id={item.id} />
  </>;
}

export function AskTutorButton({ item }: { item: Item }) {
  const tutor = useTutor();
  return (
    <button type="button" className="btn ghost ask-topic" onClick={() => tutor.start({ topic: { id: item.id, title: item.t } })}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" /></svg>
      Ask the tutor
    </button>
  );
}

export function ItemCard({ item, index, openId, doneLabel, noun }: { item: Item; index: number; openId?: string | null; doneLabel: string; noun?: string }) {
  const status = useProgress().get(item.id);
  const pinned = usePins().forItem(item.id).length;
  const mins = readingMinutes(item);
  return (
    <Collapsible id={item.id} n={String(index + 1).padStart(2, "0")} title={item.t} sub={item.sum} openId={openId} state={status}
      meta={<>
        <span className="tag">{item.tag}</span>
        <XpChip item={item} />
        <span className="tag" title="Estimated reading time">{mins} min</span>
        {item.primer && <span className="chip acc">beginner → expert</span>}
        {item.lab && <span className="chip">lab</span>}
        {item.viz && <span className="chip acc">figure</span>}
        {item.drill && <span className="chip">exercise</span>}
        {item.qa && <span className="tag">{item.qa.length} checks</span>}
        {item.refs && <span className="tag">{item.refs.length} sources</span>}
        {pinned > 0 && <span className="chip pin-chip" title="Tutor answers pinned in this lesson">{pinned} pinned</span>}
        <StatusChip id={item.id} doneLabel={doneLabel} />
      </>}>
      <div className="focus-row">
        <span>{mins} min read</span>
        <Link to={lessonPath(item.id)} className="focus-link">
          Read as a full page
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" /></svg>
        </Link>
      </div>
      <LessonBody item={item} />
      <div className="fcontrols">
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", alignSelf: "center" }}>
          Mark this {noun || (doneLabel === "done" ? "design" : "topic")}
        </span>
        <StatusButtons id={item.id} />
        <AskTutorButton item={item} />
      </div>
    </Collapsible>
  );
}
