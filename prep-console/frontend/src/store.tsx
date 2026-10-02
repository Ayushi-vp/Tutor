/* Progress store. For a signed-in user the Flask API (SQLite) is the source of truth;
   every change is applied optimistically here and then sent to the server. If the
   server is unreachable the app keeps working from a localStorage copy and says so.
   Each user has their own localStorage copy, cleared on sign-out. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, call } from "./api";
import { progressKey, useAuth } from "./auth";
import { pct, todayKey } from "./util";

export type Status = "done" | "rev";
export interface MockLog { round: string; at: number; used: number; notes: string }
export interface State {
  items: Record<string, Status>;
  days: Record<string, number>;
  srs: Record<string, { box: number; due: string }>;
  notes: Record<string, string>;
  logs: MockLog[];
}
export type Mode = "loading" | "server" | "local";

const EMPTY: State = { items: {}, days: {}, srs: {}, notes: {}, logs: [] };

interface Api {
  state: State;
  mode: Mode;
  get(id: string): Status | null;
  setStatus(id: string, status: Status | null): void;
  cycle(id: string, target: Status): void;
  setSrs(id: string, box: number, due: string): void;
  addMock(round: string, used: number, notes: string): void;
  importState(data: unknown): Promise<string>;
  resetProgress(): Promise<void>;
  progressOf(ids: string[]): { d: number; n: number; p: number };
  streak(): number;
}

const Ctx = createContext<Api | null>(null);

function readLocal(key: string): State {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return EMPTY; }
}

/** Progress saved in this browser before accounts existed (or while the server was down). */
export function browserCopy(): State | null {
  const s = readLocal(progressKey(null));
  const n = Object.keys(s.items).length + Object.keys(s.srs).length + s.logs.length;
  return n ? s : null;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const uid = auth.status === "signed-in" && auth.user ? auth.user.id : null;
  const key = progressKey(uid);
  const [state, setState] = useState<State>(() => readLocal(key));
  const [mode, setMode] = useState<Mode>(uid === null ? "local" : "loading");
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const { expired } = auth;

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) expired();
    else setMode("local");
  }, [expired]);

  useEffect(() => {
    setState(readLocal(key));
    if (uid === null) { setMode("local"); return; }
    setMode("loading");
    call<State>("GET", "/api/state").then(s => { setState(s); setMode("server"); }).catch(fail);
  }, [uid, key, fail]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* private mode */ } }, [key, state]);

  /** Send a change to the server; on failure drop to local mode rather than losing it. */
  const send = useCallback((method: string, url: string, body: unknown) => {
    if (modeRef.current !== "server") return;
    call(method, url, body).catch(fail);
  }, [fail]);

  const setStatus = useCallback((id: string, status: Status | null) => {
    setState(s => {
      const prev = s.items[id] || null;
      const items = { ...s.items };
      if (status) items[id] = status; else delete items[id];
      const days = { ...s.days };
      if (status === "done" && prev !== "done") days[todayKey()] = (days[todayKey()] || 0) + 1;
      return { ...s, items, days };
    });
    send("PUT", `/api/items/${encodeURIComponent(id)}`, { status });
  }, [send]);

  const api = useMemo<Api>(() => ({
    state, mode,
    get: id => state.items[id] || null,
    setStatus,
    cycle: (id, target) => setStatus(id, state.items[id] === target ? null : target),
    setSrs: (id, box, due) => {
      setState(s => ({ ...s, srs: { ...s.srs, [id]: { box, due } } }));
      send("PUT", `/api/srs/${encodeURIComponent(id)}`, { box, due });
    },
    addMock: (round, used, notes) => {
      setState(s => ({ ...s, logs: [...s.logs, { round, at: Date.now(), used, notes }],
        days: { ...s.days, [todayKey()]: (s.days[todayKey()] || 0) + 1 } }));
      send("POST", "/api/mocks", { round, used, notes });
    },
    importState: async data => {
      const r = await call<{ state: State; imported: Record<string, number> }>("POST", "/api/import", data);
      setState(r.state); setMode("server");
      const c = r.imported;
      return `Imported ${c.items} statuses, ${c.srs} flashcard schedules, ${c.days} activity days, ${c.logs} mock sessions.`;
    },
    resetProgress: async () => {
      if (mode === "server") setState(await call<State>("DELETE", "/api/progress"));
      else setState(EMPTY);
    },
    progressOf: ids => {
      let d = 0; for (const i of ids) if (state.items[i] === "done") d++;
      return { d, n: ids.length, p: pct(d, ids.length) };
    },
    streak: () => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        if (state.days[k]) n++; else if (i > 0) break;
      }
      return n;
    },
  }), [state, mode, setStatus, send]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProgress(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProgress outside ProgressProvider");
  return v;
}
