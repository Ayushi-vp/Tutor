/* The page tutor: chat state shared by the panel, the highlight menu and the
   "Ask the tutor" buttons. Answers stream from POST /api/chat as server-sent events. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Anchor } from "./anchor";
import { ApiError, call } from "./api";
import { useAuth } from "./auth";
import { BANK, DSA, ITEM_INDEX, PATTERNS } from "./content";

export interface TutorConfig { enabled: boolean; model: string; limit: number | null; used: number; offline?: boolean }
/** `anchor` is the text around `selection`, kept so an answer can be pinned beside the exact passage. */
export interface Msg { id?: number; role: "user" | "assistant"; text: string; selection?: string; anchor?: Anchor; pending?: boolean; error?: string; question?: string }
export interface ThreadSummary { id: number; item_id: string; title: string; updated_at: number; messages: number }
export interface Topic { id: string; title: string }

/** The selection is capped where the server caps it, so what you see quoted is what is sent. */
export const MAX_SELECTION = 4000;

/** Quick actions offered on highlighted text: [label, question]. */
export const QUICK: [string, string][] = [
  ["Explain", "Explain this passage in plain words: what it means and why it matters."],
  ["Example", "Give me a small concrete example of this."],
  ["Simplify", "Explain this as if I am new to the topic, with an analogy."],
  ["Quiz me", "Ask me one interview-style question about this passage. Wait for my answer before explaining."],
];

/** Starters shown in an empty chat. */
export const STARTERS = {
  topic: ["Summarise this topic in 5 bullet points", "What do interviewers usually ask about this?",
    "Explain this topic like I'm new to it", "Quiz me on this topic, one question at a time"],
  page: ["What should I focus on in this section?", "Make me a 30-minute study plan for today"],
};

const TITLES: Record<string, string> = {};
function titleOf(id: string): string | null {
  if (!Object.keys(TITLES).length) {
    for (const [k, v] of Object.entries(ITEM_INDEX)) TITLES[k] = v.t;
    for (const p of PATTERNS) TITLES[`pat-${p.k}`] = `Pattern: ${p.n}`;
    for (const q of DSA) TITLES[q.id] = q.t;
    for (const b of BANK) if (!b.src) TITLES[b.id] = b.q;
  }
  const derived = id.match(/^qa-(.+)-\d+$/);
  return TITLES[id] ?? (derived ? TITLES[derived[1]] ?? null : null);
}
export function topicOf(id: string | null | undefined): Topic | null {
  const t = id ? titleOf(id) : null;
  return id && t ? { id: id.replace(/^qa-(.+)-\d+$/, "$1"), title: t } : null;
}

/** The card a node sits in: topics, designs, patterns and bank questions carry their id. */
export function topicFromNode(node: Node | null): Topic | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return topicOf(el?.closest(".topic[id]")?.id);
}

/** The open card that fills most of the screen, for a question asked without highlighting. */
function visibleTopic(): Topic | null {
  let best: Topic | null = null, most = 0;
  document.querySelectorAll<HTMLElement>('main .topic[data-open="1"][id]').forEach(el => {
    const r = el.getBoundingClientRect();
    const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    const t = topicOf(el.id);
    if (t && shown >= most) { most = shown; best = t; }
  });
  return best;
}

function pageTitle(): string {
  return document.querySelector("main h1")?.textContent?.trim().slice(0, 200) || document.title;
}

/** Read a text/event-stream response, calling `on` for each event. */
async function readEvents(r: Response, on: (event: string, data: Record<string, unknown>) => void) {
  const reader = r.body?.getReader();
  if (!reader) { on("error", { error: "The browser could not read the answer stream." }); return; }
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = "message", data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) { try { on(event, JSON.parse(data)); } catch { /* a malformed event is skipped */ } }
    }
  }
}

interface Ask { selection?: string; anchor?: Anchor; topic?: Topic | null }
interface Api {
  open: boolean;
  setOpen(open: boolean): void;
  config: TutorConfig | null;
  topic: Topic | null;
  setTopic(t: Topic | null): void;
  threadId: number | null;
  messages: Msg[];
  streaming: boolean;
  threads: ThreadSummary[];
  /** Text quoted into the next question. */
  quote: string;
  setQuote(q: string, anchor?: Anchor): void;
  quoteAnchor: Anchor | undefined;
  focusToken: number;
  ask(question: string, opts?: Ask): void;
  /** Open the panel for a topic and/or passage, ready to type. */
  start(opts?: Ask & { question?: string }): void;
  stop(): void;
  newChat(): void;
  loadThread(id: number): Promise<void>;
  deleteThread(id: number): Promise<void>;
}

const Ctx = createContext<Api | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const { expired } = useAuth();
  const [open, setOpenState] = useState(false);
  const [config, setConfig] = useState<TutorConfig | null>(null);
  const [topic, setTopicState] = useState<Topic | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [quote, setQuoteText] = useState("");
  const [quoteAnchor, setQuoteAnchor] = useState<Anchor | undefined>();
  const setQuote = useCallback((q: string, anchor?: Anchor) => { setQuoteText(q); setQuoteAnchor(q ? anchor : undefined); }, []);
  const [focusToken, setFocusToken] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const live = useRef({ topic, threadId, streaming });
  live.current = { topic, threadId, streaming };

  const loadConfig = useCallback(() => {
    call<TutorConfig>("GET", "/api/chat/config").then(setConfig)
      .catch(e => setConfig({ enabled: false, model: "", limit: null, used: 0, offline: !(e instanceof ApiError) }));
  }, []);

  const loadThreads = useCallback((t: Topic | null) => {
    call<ThreadSummary[]>("GET", t ? `/api/chat/threads?item=${encodeURIComponent(t.id)}` : "/api/chat/threads")
      .then(setThreads).catch(() => setThreads([]));
  }, []);

  const setOpen = useCallback((o: boolean) => {
    setOpenState(o);
    if (o) { loadConfig(); setFocusToken(n => n + 1); }
  }, [loadConfig]);

  useEffect(() => { if (open) loadThreads(topic); }, [open, topic, loadThreads]);

  const reset = () => { abort.current?.abort(); setThreadId(null); setMessages([]); };

  /** Switching topic starts a fresh chat, so each topic's chats stay about that topic. */
  const setTopic = useCallback((t: Topic | null) => {
    if ((t?.id ?? null) === (live.current.topic?.id ?? null)) return;
    setTopicState(t);
    reset();
  }, []);

  const ask = useCallback((question: string, opts: Ask = {}) => {
    const q = question.trim();
    if (!q || live.current.streaming) return;
    let t = live.current.topic, tid = live.current.threadId;
    if (opts.topic !== undefined && (opts.topic?.id ?? null) !== (t?.id ?? null)) {
      t = opts.topic; tid = null;
      setTopicState(t); setThreadId(null); setMessages([]);
    }
    const selection = (opts.selection ?? "").slice(0, MAX_SELECTION);
    setOpenState(true);
    setQuote("");
    const anchor = selection ? opts.anchor : undefined;
    setMessages(m => [...m, { role: "user", text: q, selection, anchor }, { role: "assistant", text: "", pending: true, question: q }]);
    setStreaming(true);
    const ctl = new AbortController();
    abort.current = ctl;
    const patchLast = (f: (m: Msg) => Msg) => setMessages(ms => ms.map((m, i) => (i === ms.length - 1 ? f(m) : m)));

    (async () => {
      try {
        const r = await fetch("/api/chat", {
          method: "POST", credentials: "same-origin", signal: ctl.signal,
          headers: { "X-Prep-Client": "1", "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, selection, itemId: t?.id, page: t ? undefined : pageTitle(), threadId: tid ?? undefined }),
        });
        if (!r.ok) {
          let msg = `The tutor is unavailable (${r.status}).`;
          try { msg = (await r.json()).error || msg; } catch { /* not JSON */ }
          if (r.status === 401) expired();
          setMessages(ms => ms.slice(0, -1).concat({ role: "assistant", text: "", error: msg, question: q }));
          return;
        }
        await readEvents(r, (event, data) => {
          if (event === "meta") {
            setThreadId(data.threadId as number);
            setMessages(ms => ms.map((m, i) => (i === ms.length - 2 ? { ...m, id: data.questionId as number } : m)));
          } else if (event === "delta") patchLast(m => ({ ...m, text: m.text + String(data.t ?? "") }));
          else if (event === "done") patchLast(m => ({ ...m, pending: false, id: (data.answerId as number) ?? undefined }));
          else if (event === "error") patchLast(m => ({ ...m, pending: false, error: String(data.error ?? "Something went wrong.") }));
        });
        patchLast(m => (m.pending ? { ...m, pending: false } : m));
      } catch (e) {
        if ((e as Error).name === "AbortError") patchLast(m => ({ ...m, pending: false, error: m.text ? undefined : "Stopped." }));
        else patchLast(m => ({ ...m, pending: false, error: "Could not reach the server. Check your connection and try again." }));
      } finally {
        setStreaming(false);
        if (abort.current === ctl) abort.current = null;
        loadConfig();
        loadThreads(t);
      }
    })();
  }, [expired, loadConfig, loadThreads, setQuote]);

  const api = useMemo<Api>(() => ({
    open, setOpen, config, topic, setTopic, threadId, messages, streaming, threads, quote, setQuote, quoteAnchor, focusToken, ask,
    start: (opts = {}) => {
      const t = opts.topic !== undefined ? opts.topic : (live.current.topic ?? visibleTopic());
      setTopic(t);
      if (opts.selection) setQuote(opts.selection.slice(0, MAX_SELECTION), opts.anchor);
      if (opts.question) ask(opts.question, { selection: opts.selection, anchor: opts.anchor, topic: t });
      else setOpen(true);
    },
    stop: () => abort.current?.abort(),
    newChat: () => { reset(); setFocusToken(n => n + 1); },
    loadThread: async id => {
      abort.current?.abort();
      const t = await call<{ id: number; item_id: string; messages: Msg[] }>("GET", `/api/chat/threads/${id}`);
      setTopicState(topicOf(t.item_id));
      setThreadId(t.id);
      setMessages(t.messages.map(m => ({ id: m.id, role: m.role, text: m.text, selection: m.selection })));
    },
    deleteThread: async id => {
      await call("DELETE", `/api/chat/threads/${id}`);
      if (live.current.threadId === id) reset();
      setThreads(ts => ts.filter(x => x.id !== id));
    },
  }), [open, setOpen, config, topic, setTopic, threadId, messages, streaming, threads, quote, setQuote, quoteAnchor, focusToken, ask]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTutor(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTutor outside TutorProvider");
  return v;
}
