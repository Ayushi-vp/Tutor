import { useProgress } from "../store";

/** ↻ (review) and ✓ (done) toggles for any tracked id. */
export function StatusButtons({ id }: { id: string }) {
  const { get, cycle } = useProgress();
  const s = get(id);
  return (
    <span className="st">
      <button type="button" className="rev" aria-pressed={s === "rev"} title="Mark for review" aria-label="Mark for review"
        onClick={e => { e.stopPropagation(); cycle(id, "rev"); }}>↻</button>
      <button type="button" className="dn" aria-pressed={s === "done"} title="Mark done" aria-label="Mark done"
        onClick={e => { e.stopPropagation(); cycle(id, "done"); }}>✓</button>
    </span>
  );
}

export function StatusChip({ id, doneLabel = "learned" }: { id: string; doneLabel?: string }) {
  const s = useProgress().get(id);
  if (s === "done") return <span className="chip easy">{doneLabel}</span>;
  if (s === "rev") return <span className="chip med">review</span>;
  return null;
}

export function ProgressBar({ p }: { p: number }) {
  return <div className="bar" style={{ flex: "1 1 140px", maxWidth: 220 }}><i style={{ width: `${p}%` }} /></div>;
}
