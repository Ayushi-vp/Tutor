/* Reading settings: text size and line width for lessons, kept per browser like the theme.
   They are applied as two CSS variables on <html>, which the lesson styles read:
   --read-scale (multiplies lesson font sizes) and --measure (the prose column width). */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export const SIZES = [{ k: "s", l: "S", v: 0.92 }, { k: "m", l: "M", v: 1 }, { k: "l", l: "L", v: 1.1 }, { k: "xl", l: "XL", v: 1.22 }] as const;
export const WIDTHS = [{ k: "narrow", l: "Narrow", v: "58ch" }, { k: "normal", l: "Normal", v: "68ch" }, { k: "wide", l: "Wide", v: "86ch" }] as const;
export interface Reading { size: (typeof SIZES)[number]["k"]; width: (typeof WIDTHS)[number]["k"] }

const KEY = "apc.reading";
const DEFAULT: Reading = { size: "m", width: "normal" };

function load(): Reading {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      size: SIZES.some(s => s.k === r.size) ? r.size : DEFAULT.size,
      width: WIDTHS.some(w => w.k === r.width) ? r.width : DEFAULT.width,
    };
  } catch { return DEFAULT; }
}

function apply(r: Reading) {
  const root = document.documentElement.style;
  root.setProperty("--read-scale", String(SIZES.find(s => s.k === r.size)!.v));
  root.setProperty("--measure", WIDTHS.find(w => w.k === r.width)!.v);
}

/** The "Aa" button in the top bar and its popover. */
export function ReadingMenu() {
  const [r, setR] = useState<Reading>(load);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => {
    apply(r);
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ }
  }, [r]);
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
  const changed = r.size !== DEFAULT.size || r.width !== DEFAULT.width;
  return (
    <div className="rmenu" ref={ref}>
      <button className="tbtn" type="button" aria-haspopup="dialog" aria-expanded={open} aria-label="Reading settings" title="Reading settings"
        onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true" className="rmenu-aa">Aa</span>
      </button>
      {open && (
        <div className="rmenu-pop" role="dialog" aria-label="Reading settings">
          <div className="rmenu-h">Text size</div>
          <div className="seg" role="group" aria-label="Text size">
            {SIZES.map(s => <button key={s.k} type="button" aria-pressed={r.size === s.k} onClick={() => setR({ ...r, size: s.k })}
              style={{ fontSize: 11 * s.v }}>{s.l}</button>)}
          </div>
          <div className="rmenu-h">Line width</div>
          <div className="seg" role="group" aria-label="Line width">
            {WIDTHS.map(w => <button key={w.k} type="button" aria-pressed={r.width === w.k} onClick={() => setR({ ...r, width: w.k })}>{w.l}</button>)}
          </div>
          <p className="rmenu-note">Applies to lessons and design cases. Saved in this browser.</p>
          {changed && <button type="button" className="rmenu-reset" onClick={() => setR(DEFAULT)}>Reset to default</button>}
        </div>
      )}
    </div>
  );
}
