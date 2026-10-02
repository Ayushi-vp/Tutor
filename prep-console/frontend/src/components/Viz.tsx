import { useEffect, useRef } from "react";
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
  return <div ref={ref} />;
}

/** Trusted HTML from content/*.json (authored by us, not user input). */
export function Html({ html, className = "prose" }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
