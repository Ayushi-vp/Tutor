/* Tutor answers shown inside the lesson: the pinned passage is highlighted and a
   collapsible card sits right under its paragraph. Clicking the highlight opens the card. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { markPassage, slotAfter, unmarkAll } from "../anchor";
import { Markdown } from "../markdown";
import { usePins, type Pin } from "../pins";
import { QUICK, topicOf, useTutor } from "../tutor";

export const PinIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2.5 13.5 6l-2.2.8-2.6 2.6.3 3.1-1.3 1.3L4.2 10.3l-2 2M5.2 7.8 1 13" /><path d="M6.4 5.4 8.9 2.9" />
  </svg>
);

/** "Explain", "Example"… for the quick actions; otherwise the question itself. */
function label(q: string): string {
  return QUICK.find(([, text]) => text === q)?.[0] ?? q;
}

function PinCard({ pin, open, onToggle, orphan }: { pin: Pin; open: boolean; onToggle(): void; orphan?: boolean }) {
  const pins = usePins();
  const tutor = useTutor();
  const [busy, setBusy] = useState(false);
  const cont = () => {
    if (pin.thread_id) void tutor.loadThread(pin.thread_id).then(() => tutor.setOpen(true)).catch(() => tutor.start({ topic: topicOf(pin.item_id), selection: pin.quote }));
    else tutor.start({ topic: topicOf(pin.item_id), selection: pin.quote, anchor: { prefix: pin.prefix, suffix: pin.suffix } });
  };
  return (
    <div className={`pin-card${open ? " open" : ""}`} data-pin-card={pin.id}>
      <button type="button" className="pin-head" aria-expanded={open} onClick={onToggle}>
        <PinIcon /><span className="pin-l">Tutor</span><span className="pin-q">{label(pin.question)}</span>
        <svg className="pin-caret" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2l4 4-4 4" /></svg>
      </button>
      {open && (
        <div className="pin-body">
          {orphan && <q className="tmsg-q">{pin.quote.length > 280 ? pin.quote.slice(0, 280) + "…" : pin.quote}</q>}
          {label(pin.question) === pin.question && <p className="pin-ask">{pin.question}</p>}
          <Markdown text={pin.answer} />
          <div className="pin-acts">
            <button type="button" onClick={cont}>Continue in tutor</button>
            <button type="button" disabled={busy} onClick={() => { setBusy(true); pins.remove(pin.id).catch(() => setBusy(false)); }}>Remove pin</button>
            <span>{new Date(pin.created_at * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Rendered inside an open topic; finds the topic's lesson body around itself. */
export function PinLayer({ itemId }: { itemId: string }) {
  const pins = usePins().forItem(itemId);
  const here = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ pin: Pin; slot: HTMLElement }[]>([]);
  const [orphans, setOrphans] = useState<Pin[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const key = pins.map(p => p.id).join(",");

  useLayoutEffect(() => {
    const root = here.current?.closest(".topic-b");
    if (!root || !pins.length) { setPlaced([]); setOrphans([]); return; }
    const found: { pin: Pin; slot: HTMLElement }[] = [], lost: Pin[] = [];
    for (const pin of pins) {
      const marks = markPassage(root, pin.id, pin.quote, { prefix: pin.prefix, suffix: pin.suffix });
      if (marks.length) found.push({ pin, slot: slotAfter(root, marks[marks.length - 1]) });
      else lost.push(pin);
    }
    setPlaced(found);
    setOrphans(lost);
    return () => {
      root.querySelectorAll(".pin-slot").forEach(s => s.remove());
      unmarkAll(root);
    };
  }, [itemId, key]);  // the pins' content never changes, only which ones exist

  // Clicking a highlighted passage opens (or closes) its card.
  useEffect(() => {
    const root = here.current?.closest(".topic-b");
    if (!root) return;
    const click = (e: Event) => {
      const mark = (e.target as Element).closest?.("mark.pin-mark") as HTMLElement | null;
      if (mark && !window.getSelection()?.toString()) setOpenId(id => (id === Number(mark.dataset.pin) ? null : Number(mark.dataset.pin)));
    };
    root.addEventListener("click", click);
    return () => root.removeEventListener("click", click);
  }, []);

  // The open card's passage is shown as active.
  useEffect(() => {
    const root = here.current?.closest(".topic-b");
    root?.querySelectorAll<HTMLElement>("mark.pin-mark").forEach(m => m.classList.toggle("on", Number(m.dataset.pin) === openId));
  }, [openId, placed]);

  // ?pin=<id> (from "show in lesson") opens that card and brings its passage into view.
  const wanted = Number(params.get("pin")) || null;
  useEffect(() => {
    if (!wanted || !placed.some(p => p.pin.id === wanted)) return;
    setOpenId(wanted);
    const t = window.setTimeout(() => {
      here.current?.closest(".topic-b")?.querySelector(`mark[data-pin="${wanted}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      const next = new URLSearchParams(params);
      next.delete("pin");
      setParams(next, { replace: true });
    }, 450);
    return () => window.clearTimeout(t);
  }, [wanted, placed]);

  const toggle = (id: number) => setOpenId(o => (o === id ? null : id));
  return (
    <div ref={here} className="pin-orphans" hidden={!orphans.length}>
      {placed.map(({ pin, slot }) => createPortal(<PinCard pin={pin} open={openId === pin.id} onToggle={() => toggle(pin.id)} />, slot, String(pin.id)))}
      {orphans.length > 0 && <>
        <div className="pin-orphans-h">Pinned answers whose passage has changed</div>
        {orphans.map(pin => <PinCard key={pin.id} pin={pin} orphan open={openId === pin.id} onToggle={() => toggle(pin.id)} />)}
      </>}
    </div>
  );
}
