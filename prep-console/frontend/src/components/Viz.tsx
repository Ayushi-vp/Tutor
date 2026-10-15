import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { mountViz, vizHTML } from "../legacy/viz.js";

/** Mounts one of the hand-built figures from legacy/viz.js by key. */
export function Viz({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = vizHTML(name);
    mountViz(el);
    return () => { el.innerHTML = ""; };
  }, [name]);
  return <div ref={ref} data-toc="viz" />;
}

const COPY_ICON = '<svg class="i-copy" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5"/><path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H4A1.5 1.5 0 0 0 2.5 3.5V10A1.5 1.5 0 0 0 4 11.5h1.5"/></svg>'
  + '<svg class="i-ok" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>';

function copied(b: HTMLElement) {
  b.classList.add("ok");
  b.setAttribute("aria-label", "Copied");
  window.setTimeout(() => { b.classList.remove("ok"); b.setAttribute("aria-label", "Copy code"); }, 1500);
}

/** Wraps every <pre> under root in .codewrap with a copy button. Safe to run twice.
    The button holds only an icon, so it adds no text that pins or the tutor would pick up. */
export function addCopyButtons(root: HTMLElement) {
  root.querySelectorAll("pre").forEach(pre => {
    if (pre.parentElement?.classList.contains("codewrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "codewrap";
    pre.parentNode!.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "copy-code";
    b.title = "Copy";
    b.setAttribute("aria-label", "Copy code");
    b.innerHTML = COPY_ICON;
    b.addEventListener("click", () => { void navigator.clipboard?.writeText(pre.textContent || "").then(() => copied(b)).catch(() => {}); });
    wrap.appendChild(b);
  });
}

/** Trusted HTML from content/*.json (authored by us, not user input). */
export function Html({ html, className = "prose", toc }: { html: string; className?: string; toc?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) addCopyButtons(ref.current); }, [html]);
  return <div ref={ref} className={className} data-toc={toc} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A code block rendered from a plain string, with the same copy button. */
export function CodeBlock({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1500); }).catch(() => {});
  };
  return (
    <div className="codewrap">
      <pre>{code}</pre>
      <button type="button" className={`copy-code${ok ? " ok" : ""}`} title="Copy" aria-label={ok ? "Copied" : "Copy code"}
        onClick={copy} dangerouslySetInnerHTML={{ __html: COPY_ICON }} />
    </div>
  );
}
