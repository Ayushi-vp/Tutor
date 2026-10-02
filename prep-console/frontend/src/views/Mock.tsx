import { useEffect, useState } from "react";
import { BANK, DESIGNS, DSA, PAT_NAME, ROUNDS, type Level, type Round } from "../content";
import { useProgress } from "../store";
import { DIFF_CLS, DIFF_NAME, shuffle } from "../util";

interface Drawn { id: string; q: string; a: string; d?: Level; pat?: string }
interface Session { round: Round; qs: Drawn[]; endsAt: number; started: number; notes: string }

function draw(r: Round): Drawn[] {
  const bank = (cats: string[], n: number) => shuffle(BANK.filter(b => cats.includes(b.cat))).slice(0, n)
    .map(b => ({ id: b.id, q: b.q, a: b.a, d: b.d }));
  const dsa = (d: Level) => { const q = shuffle(DSA.filter(p => p.d === d))[0]; return { id: q.id, q: q.t, a: q.k, d: q.d, pat: PAT_NAME[q.p] }; };
  switch (r.draw.type) {
    case "dsa": return [dsa("M"), dsa(Math.random() < 0.5 ? "M" : "H")];
    case "bank": return bank(r.draw.cats, r.draw.n);
    case "design": {
      const c = shuffle(DESIGNS[r.draw.source])[0];
      return [{ id: c.id, q: c.t, a: r.draw.hint, d: "H" as Level }, ...bank([r.draw.cat], r.draw.extra)];
    }
  }
}

export function Mock() {
  const { state, addMock } = useProgress();
  const [s, setS] = useState<Session | null>(null);
  const [peek, setPeek] = useState<Record<number, boolean>>({});
  const [, tick] = useState(0);
  useEffect(() => {
    if (!s) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [s]);

  if (!s) {
    const logs = state.logs.slice(-6).reverse();
    return (
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="eyebrow">Simulation</div>
        <h1 className="page-h">Mock interview</h1>
        <p className="lede">Pick a round, start the clock, and work it exactly as you would on the day — out loud, from requirements to trade-offs. The draw is random, so you cannot rehearse the specific question.</p>
        <div className="grid g2" style={{ marginTop: 22 }}>
          {ROUNDS.map(r => (
            <button key={r.id} className="card" type="button" style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => { setPeek({}); setS({ round: r, qs: draw(r), endsAt: Date.now() + r.mins * 60000, started: Date.now(), notes: "" }); }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span className="card-t">{r.n}</span><span className="chip" style={{ marginLeft: "auto" }}>{r.mins} min</span></div>
              <p className="card-s" style={{ marginTop: 4 }}>{r.d}</p>
            </button>
          ))}
        </div>
        {logs.length > 0 && (
          <div className="sec"><h2 className="sec-h">Recent sessions</h2>
            <p className="sec-s">Your own notes are the most useful revision material you will produce.</p>
            <div className="tscroll"><table><thead><tr><th>Round</th><th>When</th><th className="num">Minutes</th><th>Notes</th></tr></thead>
              <tbody>{logs.map(l => (
                <tr key={l.at}><td style={{ fontWeight: 600 }}>{l.round}</td>
                  <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{new Date(l.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="num">{l.used}</td>
                  <td style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 340 }}>{(l.notes || "—").slice(0, 160)}</td></tr>))}
              </tbody></table></div>
          </div>
        )}
      </div>
    );
  }

  const left = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
  const clock = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="eyebrow">Simulation · in progress</div>
      <div className="rowh" style={{ alignItems: "center" }}>
        <div><h1 className="page-h" style={{ marginBottom: 2 }}>{s.round.n}</h1><p style={{ color: "var(--muted)", fontSize: 13.5 }}>{s.round.d}</p></div>
        <div style={{ textAlign: "right" }}>
          <div className={`timer${left < 300 ? " low" : ""}`}>{clock}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>remaining of {s.round.mins} min</div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>{s.qs.map((q, i) => (
        <div className="qcard" key={q.id + i}>
          <div className="qq"><span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginRight: 7 }}>{String(i + 1).padStart(2, "0")}</span>{q.q}</div>
          {q.pat && <><span className="tag">{q.pat}</span> </>}
          {q.d && <span className={`chip ${DIFF_CLS[q.d]}`}>{DIFF_NAME[q.d]}</span>}
          <button type="button" onClick={() => setPeek(p => ({ ...p, [i]: !p[i] }))}
            style={{ marginLeft: 8, padding: "3px 9px", border: "1px solid var(--line-2)", borderRadius: 5, background: "var(--surface)", cursor: "pointer", fontSize: 11.5 }}>
            {peek[i] ? "Hide hint" : "Hint"}</button>
          {peek[i] && <div className="qa">{q.a}</div>}
        </div>))}
      </div>
      <div className="sec" style={{ marginTop: 22 }}>
        <h2 className="sec-h">Notes</h2>
        <p className="sec-s">What you said, what you missed, what you would do differently. Saved with the session.</p>
        <textarea className="notes" placeholder="Approach, complexity, what tripped you up…" value={s.notes}
          onChange={e => setS({ ...s, notes: e.target.value })} />
        <div className="fcontrols">
          <button className="btn" type="button" onClick={() => { addMock(s.round.n, Math.max(1, Math.round((Date.now() - s.started) / 60000)), s.notes); setS(null); }}>Finish and save</button>
          <button className="btn ghost" type="button" onClick={() => setS(null)}>Abandon</button>
        </div>
      </div>
    </div>
  );
}
