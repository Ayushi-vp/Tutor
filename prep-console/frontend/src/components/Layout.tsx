import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ALL_IDS, NAV } from "../content";
import { useProgress } from "../store";
import { Avatar } from "./Avatar";

type Theme = "system" | "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("apc.theme") as Theme) || "system");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    try { localStorage.setItem("apc.theme", theme); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent("themechange"));   // legacy figures redraw on this
  }, [theme]);
  return [theme, () => setTheme(t => (t === "system" ? "light" : t === "light" ? "dark" : "system"))];
}

function Ring() {
  const { progressOf } = useProgress();
  const g = progressOf(ALL_IDS);
  const C = 2 * Math.PI * 15;
  return (
    <div className="ring" title={`Overall completion: ${g.d} of ${g.n} items`}>
      <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${((g.p / 100) * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 18 18)" />
      </svg>
      <div><b>{g.p}%</b><span>ready</span></div>
    </div>
  );
}

function Search() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(loc.pathname === "/search" ? params.get("q") || "" : "");
  useEffect(() => { if (loc.pathname !== "/search") setQ(""); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement)?.tagName)) {
        e.preventDefault(); document.getElementById("globalSearch")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="search">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="6" cy="6" r="4.2" /><path d="M9.2 9.2 12.5 12.5" /></svg>
      <input id="globalSearch" type="search" placeholder="Search topics, problems, questions…  ( / )" aria-label="Search everything"
        value={q} onChange={e => {
          const v = e.target.value; setQ(v);
          if (v.trim().length >= 2) nav(`/search?q=${encodeURIComponent(v.trim())}`, { replace: loc.pathname === "/search" });
          else if (loc.pathname === "/search") nav(-1);
        }} />
    </div>
  );
}

function SaveDot() {
  const { mode } = useProgress();
  const label = mode === "server" ? "Progress saved to your account" : mode === "local"
    ? "Not connected — progress saved in this browser only" : "Connecting…";
  return <span className={`savedot${mode === "server" ? " on" : mode === "local" ? " off" : ""}`} title={label} role="img" aria-label={label} />;
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  if (!user) return null;
  return (
    <div className="umenu" ref={ref}>
      <button className="umenu-btn" type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(o => !o)}>
        <Avatar user={user} size={30} />
      </button>
      {open && (
        <div className="umenu-pop" role="menu">
          <div className="umenu-who"><b>{user.name || user.email}</b><small>{user.email}</small></div>
          <Link role="menuitem" to="/account">Account &amp; data</Link>
          {user.admin && <Link role="menuitem" to="/admin">Admin</Link>}
          <button role="menuitem" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [theme, cycleTheme] = useTheme();
  const { user } = useAuth();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("noscroll");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("noscroll"); };
  }, [drawer]);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const nav = user?.admin
    ? NAV.map(g => g.g === "Workspace" ? { ...g, items: [...g.items, { v: "admin", n: "Admin", i: "AD" }] } : g)
    : NAV;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-in">
          <button className="menu-btn" type="button" aria-label="Open navigation" aria-expanded={drawer} aria-controls="rail" onClick={() => setDrawer(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h12M3 9h12M3 13h12" /></svg>
          </button>
          <Link className="brand" to="/" aria-label="Prep Console home">
            <div className="mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fbfcfd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 14.5 C4.5 14.5 5.5 3.5 9 3.5 C12.5 3.5 13.5 14.5 16 14.5" /><circle cx="9" cy="3.5" r="1.7" fill="#fbfcfd" stroke="none" />
              </svg>
            </div>
            <div><span className="brand-t">Prep Console</span><span className="brand-s">AI Engineer Track</span></div>
          </Link>
          <div className="spacer" />
          <Search />
          <Ring />
          <button className="tbtn" type="button" onClick={cycleTheme} aria-label={`Colour theme: ${theme === "system" ? "auto" : theme}. Switch theme`}>
            <span aria-hidden="true">{theme === "system" ? "◐" : dark ? "●" : "○"}</span><span className="tbtn-l">{theme === "system" ? "Auto" : dark ? "Dark" : "Light"}</span>
          </button>
          <SaveDot />
          <UserMenu />
        </div>
      </header>
      <div className="shell">
        <div className={`scrim${drawer ? " open" : ""}`} onClick={() => setDrawer(false)} aria-hidden="true" />
        <nav id="rail" className={`rail${drawer ? " open" : ""}`} aria-label="Sections">
          <div className="rail-top">
            <span className="brand-t">Sections</span>
            <button className="menu-btn" type="button" aria-label="Close navigation" onClick={() => setDrawer(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          {nav.map((g, gi) => (
            <div key={g.g} style={{ display: "contents" }}>
              <div className={`rail-h${gi ? "" : " first"}`}>{g.g}</div>
              {g.items.map(it => (
                <NavLink key={it.v} to={it.v === "overview" ? "/" : `/${it.v}`} end className="navb">
                  <span className="ni">{it.i}</span><span>{it.n}</span>
                  {!!it.deep && <span className={`ndeep${it.deep < 1 ? " part" : ""}`}
                    title={it.deep < 1 ? `Detailed lessons: ${Math.round(it.deep * 100)}% rewritten` : "Detailed lessons"} />}
                  {it.count !== undefined && <span className="nc">{it.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main id="main" tabIndex={-1}>{children}</main>
      </div>
    </>
  );
}
