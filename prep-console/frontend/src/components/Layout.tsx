import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ALL_IDS, NAV } from "../content";
import { useProgress } from "../store";

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
    <div className="ring" title="Overall completion across all tracked items">
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

export function Layout({ children }: { children: ReactNode }) {
  const [theme, cycleTheme] = useTheme();
  const { mode } = useProgress();
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <div className="mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fbfcfd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 14.5 C4.5 14.5 5.5 3.5 9 3.5 C12.5 3.5 13.5 14.5 16 14.5" /><circle cx="9" cy="3.5" r="1.7" fill="#fbfcfd" stroke="none" />
              </svg>
            </div>
            <div><span className="brand-t">Prep Console</span><span className="brand-s">AI Engineer Track</span></div>
          </div>
          <div className="spacer" />
          <Search />
          <Ring />
          <button className="tbtn" type="button" onClick={cycleTheme} aria-label="Switch colour theme">
            <span>{theme === "system" ? "◐" : dark ? "●" : "○"}</span><span>{theme === "system" ? "Auto" : dark ? "Dark" : "Light"}</span>
          </button>
          <span className={`savedot${mode === "server" ? " on" : ""}`}
            title={mode === "server" ? "Progress saved to the local database" : mode === "local"
              ? "Server unreachable — progress saved in this browser only" : "Connecting…"} />
        </div>
      </header>
      <div className="shell">
        <nav className="rail" aria-label="Sections">
          {NAV.map((g, gi) => (
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
