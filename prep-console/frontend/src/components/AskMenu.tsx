/* Ways into the tutor from the page itself:
   - highlight text  -> a small toolbar: Explain · Example · Simplify · Quiz me · Ask…
   - right-click a highlight -> the same actions as a menu (Shift+right-click keeps the browser's menu)
   - Ctrl/⌘+K        -> open the tutor, quoting the highlight if there is one */
import { useCallback, useEffect, useRef, useState } from "react";
import { anchorOf, type Anchor } from "../anchor";
import { QUICK, topicFromNode, useTutor, type Topic } from "../tutor";
import { TUTOR_KEY } from "./TutorPanel";

interface Picked { text: string; topic: Topic | null; anchor?: Anchor; x: number; y: number; below: boolean; menu: boolean }

/** The current selection, if it is real text inside the page content (not a form field or the tutor's own input). */
function picked(): { text: string; rect: DOMRect; topic: Topic | null; anchor?: Anchor } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().replace(/\s+\n/g, "\n").trim();
  if (text.length < 2) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el || !el.closest("main, .tutor .tbody") || el.closest("input, textarea, [contenteditable], .tcompose")) return null;
  const topic = el.closest(".tutor") ? null : topicFromNode(node);
  const lesson = topic ? el.closest(".topic-b") : null;
  return { text, rect: range.getBoundingClientRect(), topic, anchor: lesson ? anchorOf(range, lesson) : undefined };
}

const coarse = () => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

export function AskMenu() {
  const tutor = useTutor();
  const tutorRef = useRef(tutor);
  tutorRef.current = tutor;
  const [p, setP] = useState<Picked | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const timer = useRef<number>();

  const show = useCallback((menuAt?: { x: number; y: number }) => {
    const s = picked();
    if (!s) { setP(null); return; }
    if (menuAt) { setP({ text: s.text, topic: s.topic, anchor: s.anchor, x: menuAt.x, y: menuAt.y, below: true, menu: true }); return; }
    // Touch screens draw their own copy/paste bar above a selection, so ours goes below.
    const below = coarse() || s.rect.top < 110;
    setP({ text: s.text, topic: s.topic, anchor: s.anchor, x: s.rect.left + s.rect.width / 2, y: below ? s.rect.bottom : s.rect.top, below, menu: false });
  }, []);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      dragging.current = true;
      if (e.button !== 2) setP(null);
    };
    const up = (e: PointerEvent) => {
      dragging.current = false;
      if (e.button === 2 || ref.current?.contains(e.target as Node)) return;
      window.setTimeout(() => show(), 0);
    };
    // Keyboard selection (Shift+arrows) and touch handles only report through selectionchange.
    const changed = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (dragging.current) return;
        if (!window.getSelection()?.toString().trim()) setP(null); else show();
      }, 350);
    };
    const context = (e: MouseEvent) => {
      if (e.shiftKey || !picked()) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      // Only take over the menu when the click lands on the highlighted text itself.
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (e.clientX < r.left - 4 || e.clientX > r.right + 4 || e.clientY < r.top - 4 || e.clientY > r.bottom + 4) return;
      e.preventDefault();
      show({ x: e.clientX, y: e.clientY });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setP(null);
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const s = picked(), t = tutorRef.current;
        if (t.open && !s) { t.setOpen(false); return; }
        t.start(s ? { selection: s.text, anchor: s.anchor, topic: s.topic } : {});
        setP(null);
      }
    };
    const hide = () => setP(cur => (cur?.menu ? null : cur));
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("selectionchange", changed);
    document.addEventListener("contextmenu", context);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("selectionchange", changed);
      document.removeEventListener("contextmenu", context);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.clearTimeout(timer.current);
    };
  }, [show]);

  // The toolbar follows the selection while the page scrolls.
  const toolbar = p !== null && !p.menu;
  useEffect(() => {
    if (!toolbar) return;
    const follow = () => {
      const s = picked();
      if (!s) { setP(null); return; }
      setP(cur => cur && { ...cur, x: s.rect.left + s.rect.width / 2, y: cur.below ? s.rect.bottom : s.rect.top });
    };
    window.addEventListener("scroll", follow, true);
    return () => window.removeEventListener("scroll", follow, true);
  }, [toolbar]);

  if (!p) return null;
  const act = (question?: string) => {
    tutor.start({ selection: p.text, anchor: p.anchor, topic: p.topic, question });
    setP(null);
  };
  const copy = () => { void navigator.clipboard?.writeText(p.text).catch(() => {}); setP(null); };
  const items: [string, () => void][] = [
    ...QUICK.map(([label, q]) => [label, () => act(q)] as [string, () => void]),
    ["Ask a question…", () => act()],
  ];

  if (p.menu) {
    const x = Math.min(p.x, window.innerWidth - 236), y = Math.min(p.y, window.innerHeight - 290);
    return (
      <div ref={ref} className="askmenu" role="menu" aria-label="Ask the tutor" style={{ left: Math.max(8, x), top: Math.max(8, y) }}>
        <div className="askmenu-h">Ask the tutor</div>
        {items.map(([label, fn]) => <button key={label} role="menuitem" type="button" onClick={fn}>{label}</button>)}
        <div className="askmenu-sep" />
        <button role="menuitem" type="button" onClick={copy}>Copy</button>
        <div className="askmenu-foot">Shift+right-click for the browser menu</div>
      </div>
    );
  }
  const x = Math.min(Math.max(p.x, 170), window.innerWidth - 170);
  return (
    <div ref={ref} className={`askbar${p.below ? " below" : ""}`} role="toolbar" aria-label="Ask the tutor about the highlighted text"
      style={{ left: x, top: p.y }} onMouseDown={e => e.preventDefault()}>
      <span className="askbar-l" title={`Ask the tutor · ${TUTOR_KEY}`}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" /></svg>
      </span>
      {QUICK.map(([label, q]) => <button key={label} type="button" onClick={() => act(q)}>{label}</button>)}
      <button type="button" className="askbar-ask" onClick={() => act()}>Ask…</button>
    </div>
  );
}
