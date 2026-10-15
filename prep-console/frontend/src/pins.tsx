/* Tutor answers pinned to a passage in a lesson. Loaded once after sign-in; needs the server. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { call } from "./api";
import { useAuth } from "./auth";

export interface Pin {
  id: number; item_id: string; quote: string; prefix: string; suffix: string;
  question: string; answer: string; thread_id: number | null; created_at: number;
}
export interface NewPin { itemId: string; quote: string; prefix: string; suffix: string; question: string; answer: string; threadId: number | null }

interface Api {
  /** False when signed out or the server is unreachable: pinning is hidden then. */
  available: boolean;
  forItem(id: string): Pin[];
  add(p: NewPin): Promise<Pin>;
  remove(id: number): Promise<void>;
}

const Ctx = createContext<Api | null>(null);

export function PinsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [available, setAvailable] = useState(false);
  const uid = status === "signed-in" ? user?.id : undefined;

  useEffect(() => {
    setPins([]);
    setAvailable(false);
    if (uid === undefined) return;
    call<Pin[]>("GET", "/api/pins").then(p => { setPins(p); setAvailable(true); }).catch(() => setAvailable(false));
  }, [uid]);

  const add = useCallback(async (p: NewPin) => {
    const pin = await call<Pin>("POST", "/api/pins", p);
    setPins(ps => [...ps, pin]);
    return pin;
  }, []);
  const remove = useCallback(async (id: number) => {
    await call("DELETE", `/api/pins/${id}`);
    setPins(ps => ps.filter(p => p.id !== id));
  }, []);

  const api = useMemo<Api>(() => ({
    available, add, remove,
    forItem: id => pins.filter(p => p.item_id === id),
  }), [pins, available, add, remove]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePins(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePins outside PinsProvider");
  return v;
}
