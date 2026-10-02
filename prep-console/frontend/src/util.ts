import type { Level } from "./content";

export const todayKey = () => new Date().toISOString().slice(0, 10);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const DIFF_NAME: Record<Level, string> = { E: "Easy", M: "Medium", H: "Hard" };
export const DIFF_CLS: Record<Level, string> = { E: "easy", M: "med", H: "hard" };

export function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Case-insensitive substring test over several fields. */
export const matches = (q: string, ...fields: (string | undefined)[]) =>
  !q || fields.join(" ").toLowerCase().includes(q.toLowerCase());
