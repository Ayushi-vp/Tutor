import { useEffect, useState } from "react";
import { XP_EVENT, type XpGain } from "../xp";

/** A short "+100 XP" confirmation when a topic is newly marked done. */
export function XpToast() {
  const [gain, setGain] = useState<(XpGain & { n: number }) | null>(null);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => setGain({ ...(e as CustomEvent<XpGain>).detail, n: ++n });
    window.addEventListener(XP_EVENT, on);
    return () => window.removeEventListener(XP_EVENT, on);
  }, []);
  useEffect(() => {
    if (!gain) return;
    const t = window.setTimeout(() => setGain(null), 3200);
    return () => window.clearTimeout(t);
  }, [gain]);
  return (
    <div className="xp-toast-slot" role="status" aria-live="polite">
      {gain && (
        <div className="xp-toast" key={gain.n}>
          <b>+{gain.xp} XP</b>
          <span>{gain.title}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setGain(null)}>×</button>
        </div>
      )}
    </div>
  );
}
