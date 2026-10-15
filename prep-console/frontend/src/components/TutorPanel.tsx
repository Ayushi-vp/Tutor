import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ITEM_INDEX } from "../content";
import { lessonPath } from "../lesson";
import { Markdown } from "../markdown";
import { usePins } from "../pins";
import { useProgress } from "../store";
import { STARTERS, useTutor, type Msg } from "../tutor";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const TUTOR_KEY = isMac ? "⌘K" : "Ctrl+K";

const Spark = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" />
  </svg>
);

function ago(t: number): string {
  const s = Date.now() / 1000 - t;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t * 1000).toLocaleDateString();
}

/** Pin an answer beside the passage it is about; then offer a link to see it there. */
function PinButton({ m, ask }: { m: Msg; ask: Msg }) {
  const { topic, threadId } = useTutor();
  const pins = usePins();
  const nav = useNavigate();
  const [pinned, setPinned] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const where = topic ? ITEM_INDEX[topic.id] : undefined;
  if (!topic || !where || !ask.selection || !pins.available) return null;
  if (pinned !== null) {
    return <button type="button" className="on" onClick={() => nav(lessonPath(topic.id, `?pin=${pinned}`))}>
      Pinned ✓ · show in lesson</button>;
  }
  const pin = () => {
    pins.add({ itemId: topic.id, quote: ask.selection!, prefix: ask.anchor?.prefix ?? "", suffix: ask.anchor?.suffix ?? "",
      question: ask.text, answer: m.text.trim(), threadId })
      .then(p => setPinned(p.id)).catch(() => setFailed(true));
  };
  return <button type="button" onClick={pin} title="Show this answer in the lesson, under the passage you highlighted">
    {failed ? "Could not pin — retry" : "Pin to lesson"}</button>;
}

function Answer({ m, ask }: { m: Msg; ask?: Msg }) {
  const { topic } = useTutor();
  const { state, setNote } = useProgress();
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(m.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  const addNote = () => {
    if (!topic) return;
    const prev = state.notes[topic.id] || "";
    const head = m.question ? `Tutor — ${m.question}` : "Tutor";
    setNote(topic.id, `${prev ? prev + "\n\n" : ""}${head}\n${m.text.trim()}`);
    setNoted(true);
  };
  return (
    <div className="tmsg tmsg-a" aria-busy={m.pending || undefined}>
      {m.text ? <Markdown text={m.text} /> : m.pending && <div className="tdots" aria-label="Thinking"><i /><i /><i /></div>}
      {m.error && <div className="terr" role="alert">{m.error}</div>}
      {!m.pending && m.text && (
        <div className="tacts">
          {ask && <PinButton m={m} ask={ask} />}
          <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          {topic && <button type="button" onClick={addNote} disabled={noted} title={`Append to your notes on “${topic.title}”`}>
            {noted ? "Added to notes ✓" : "Add to notes"}</button>}
        </div>
      )}
    </div>
  );
}

function History({ onClose }: { onClose(): void }) {
  const { threads, threadId, loadThread, deleteThread, topic } = useTutor();
  return (
    <div className="thist" role="dialog" aria-label="Earlier chats">
      <div className="thist-h">{topic ? "Earlier chats on this topic" : "Earlier chats"}</div>
      {threads.length ? threads.map(t => (
        <div key={t.id} className={`thist-row${t.id === threadId ? " on" : ""}`}>
          <button type="button" className="thist-open" onClick={() => { void loadThread(t.id); onClose(); }}>
            <b>{t.title}</b><small>{t.messages} messages · {ago(t.updated_at)}</small>
          </button>
          <button type="button" className="ticon" aria-label={`Delete chat: ${t.title}`} title="Delete" onClick={() => void deleteThread(t.id)}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4h8M5.5 4V2.5h3V4M4 4l.6 8h4.8L10 4" /></svg>
          </button>
        </div>
      )) : <p className="thist-empty">No saved chats yet{topic ? " for this topic" : ""}.</p>}
    </div>
  );
}

function Composer() {
  const { ask, streaming, stop, quote, quoteAnchor, setQuote, focusToken, config } = useTutor();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [focusToken]);
  useEffect(() => {   // grow with the text, up to a limit
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }, [text]);
  const left = config?.limit != null ? Math.max(0, config.limit - config.used) : null;
  const blocked = !config?.enabled || left === 0;
  const send = () => {
    if (!text.trim() || streaming || blocked) return;
    ask(text, { selection: quote, anchor: quoteAnchor });
    setText("");
  };
  return (
    <form className="tcompose" onSubmit={e => { e.preventDefault(); send(); }}>
      {quote && (
        <div className="tquote">
          <span className="tquote-l">Asking about</span>
          <q>{quote.length > 220 ? quote.slice(0, 220) + "…" : quote}</q>
          <button type="button" className="ticon" aria-label="Remove highlighted passage" onClick={() => setQuote("")}>×</button>
        </div>
      )}
      <div className="tinput">
        <textarea ref={ref} rows={1} value={text} disabled={blocked}
          placeholder={blocked ? "The tutor is unavailable" : quote ? "What do you want to know about this passage?" : "Ask anything about this page…"}
          aria-label="Your question" onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
        {streaming
          ? <button type="button" className="tsend stop" onClick={stop} aria-label="Stop the answer"><span /></button>
          : <button type="submit" className="tsend" disabled={!text.trim() || blocked} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
            </button>}
      </div>
      <div className="tfoot">
        <span>Enter to send · Shift+Enter for a new line</span>
        {left !== null && <span className={left <= 5 ? "low" : ""}>{left} of {config!.limit} left today</span>}
      </div>
    </form>
  );
}

function Unavailable() {
  const { config } = useTutor();
  const { user } = useAuth();
  if (!config) return <div className="tempty"><div className="tdots"><i /><i /><i /></div></div>;
  return (
    <div className="tempty">
      <Spark size={22} />
      {config.offline ? <p>The tutor needs a connection to the server, and this page is offline right now.</p>
        : user?.admin ? <>
            <p><b>The tutor is not set up yet.</b> Add these to <code>prep-console/.env</code> and restart the app:</p>
            <pre className="md-code"><code>{"LLM_BASE_URL=https://api.openai.com/v1\nLLM_API_KEY=sk-...\nLLM_MODEL=gpt-4o-mini"}</code></pre>
            <p className="tsmall">Any OpenAI-compatible server works: OpenRouter, Ollama (<code>http://localhost:11434/v1</code>), LM Studio, vLLM. <code>LLM_PROVIDER=fake</code> tries the UI without a key.</p>
          </>
        : <p>The tutor is not available on this server yet. Ask the person who invited you to switch it on.</p>}
    </div>
  );
}

function Empty() {
  const { topic, ask, quote } = useTutor();
  const starters = topic ? STARTERS.topic : STARTERS.page;
  return (
    <div className="tempty">
      <Spark size={22} />
      <p><b>{topic ? `Ask about “${topic.title}”` : "Ask about anything on this page"}</b></p>
      <p className="tsmall">Tip: highlight any text on the page to explain, simplify or get an example of just that part.</p>
      {!quote && <div className="tstarters">
        {starters.map(s => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
      </div>}
    </div>
  );
}

export function TutorPanel() {
  const t = useTutor();
  const [hist, setHist] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => { setHist(false); }, [t.threadId, t.topic?.id]);
  useEffect(() => {   // follow the answer as it streams, unless the reader has scrolled up
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [t.messages]);
  useEffect(() => {
    if (!t.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { if (hist) setHist(false); else t.setOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [t.open, hist, t.setOpen]);

  if (!t.open) {
    return (
      <button type="button" className="tutor-fab" onClick={() => t.start()} aria-label={`Ask the tutor (${TUTOR_KEY})`} title={`Ask the tutor · ${TUTOR_KEY}`}>
        <Spark /><span>Ask tutor</span>
      </button>
    );
  }
  const ready = t.config?.enabled;
  return (
    <aside className="tutor" aria-label="Tutor">
      <header className="tutor-h">
        <div className="tutor-t"><Spark /><b>Tutor</b></div>
        <div className="tutor-tools">
          <button type="button" className="ticon" aria-label="Earlier chats" aria-expanded={hist} title="Earlier chats" onClick={() => setHist(h => !h)}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>
            {t.threads.length > 0 && <span className="tbadge">{t.threads.length}</span>}
          </button>
          <button type="button" className="ticon" aria-label="New chat" title="New chat" onClick={t.newChat} disabled={!t.messages.length}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </button>
          <button type="button" className="ticon" aria-label="Close tutor" title={`Close · Esc`} onClick={() => t.setOpen(false)}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      </header>
      <div className="tctx">
        {t.topic
          ? <span className="tchip" title={t.topic.title}><span className="tchip-l">Topic</span><span className="tchip-t">{t.topic.title}</span>
              <button type="button" aria-label="Ask without this topic" onClick={() => t.setTopic(null)}>×</button></span>
          : <span className="tchip off"><span className="tchip-l">Page</span><span className="tchip-t">No topic attached — open a topic or highlight text in it</span></span>}
      </div>
      {hist && <History onClose={() => setHist(false)} />}
      <div className="tbody" ref={scroller} onScroll={e => {
        const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}>
        {!ready ? <Unavailable /> : t.messages.length === 0 ? <Empty /> : t.messages.map((m, i) => m.role === "user" ? (
          <div key={i} className="tmsg tmsg-u">
            {m.selection && <q className="tmsg-q">{m.selection.length > 280 ? m.selection.slice(0, 280) + "…" : m.selection}</q>}
            <div>{m.text}</div>
          </div>
        ) : <Answer key={i} m={m} ask={t.messages[i - 1]?.role === "user" ? t.messages[i - 1] : undefined} />)}
      </div>
      <Composer />
    </aside>
  );
}
