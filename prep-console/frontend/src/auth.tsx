/* Who is signed in. Four states:
     loading     asking the server
     signed-in   /api/me answered; progress syncs to this user's account
     signed-out  the server is up but there is no session: show the landing page
     offline     the server is unreachable (or not running, e.g. `npm run dev` alone):
                 the app still works, saving progress in this browser only */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, call } from "./api";

export interface User { id: number; email: string; name: string; avatar: string; provider: string; admin: boolean }
export interface AuthConfig { providers: string[]; devLogin: boolean }
export type AuthStatus = "loading" | "signed-in" | "signed-out" | "offline";

interface Auth {
  status: AuthStatus;
  user: User | null;
  config: AuthConfig;
  refresh(): Promise<void>;
  devLogin(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Called by the store when the server rejects a request with 401 (session expired or user disabled). */
  expired(): void;
}

const Ctx = createContext<Auth | null>(null);
const NO_CONFIG: AuthConfig = { providers: [], devLogin: false };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AuthConfig>(NO_CONFIG);

  const refresh = useCallback(async () => {
    try {
      const me = await call<User>("GET", "/api/me");
      setUser(me); setStatus("signed-in");
    } catch (e) {
      setUser(null);
      if (e instanceof ApiError && e.status === 401) {
        setStatus("signed-out");
        call<AuthConfig>("GET", "/api/auth/config").then(setConfig).catch(() => setConfig(NO_CONFIG));
      } else {
        setStatus("offline");
      }
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const api = useMemo<Auth>(() => ({
    status, user, config, refresh,
    devLogin: async email => { await call("POST", "/auth/dev-login", { email }); await refresh(); },
    signOut: async () => {
      try { await call("POST", "/auth/logout", {}); } finally {
        if (user) { try { localStorage.removeItem(progressKey(user.id)); } catch { /* ignore */ } }
        setUser(null); setStatus("signed-out");
        call<AuthConfig>("GET", "/api/auth/config").then(setConfig).catch(() => setConfig(NO_CONFIG));
      }
    },
    expired: () => { setUser(null); setStatus("signed-out"); },
  }), [status, user, config, refresh]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** localStorage key for a user's offline copy; `null` is the signed-out / no-server copy. */
export function progressKey(uid: number | null): string {
  return uid === null ? "apc.progress.v2" : `apc.progress.v2.u${uid}`;
}
