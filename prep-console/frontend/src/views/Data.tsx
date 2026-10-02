import { useState } from "react";
import { useProgress } from "../store";

/** Backup, restore, and migration from the old single-file console. */
export function Data() {
  const { state, mode, importState } = useProgress();
  const [msg, setMsg] = useState("");
  const counts = {
    statuses: Object.keys(state.items).length,
    cards: Object.keys(state.srs).length,
    days: Object.keys(state.days).length,
    mocks: state.logs.length,
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      setMsg(await importState(data));
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="eyebrow">Workspace</div>
      <h1 className="page-h">Your data</h1>
      <p className="lede">Progress lives in <code>backend/prep.db</code>, a SQLite file on this machine. Export it to back it up or move it; import merges a file into what is already there.</p>
      <div className="grid g4" style={{ marginTop: 20 }}>
        <div className="stat lead"><span className="k">Storage</span><span className="v" style={{ fontSize: 22 }}>{mode === "server" ? "SQLite" : mode === "local" ? "Browser" : "…"}</span>
          <span className="d">{mode === "server" ? "connected to the local API" : mode === "local" ? "API unreachable — start the backend" : "connecting"}</span></div>
        <div className="stat"><span className="k">Marked items</span><span className="v">{counts.statuses}</span><span className="d">done or flagged</span></div>
        <div className="stat"><span className="k">Flashcards</span><span className="v">{counts.cards}</span><span className="d">scheduled</span></div>
        <div className="stat"><span className="k">Mock sessions</span><span className="v">{counts.mocks}</span><span className="d">{counts.days} active days</span></div>
      </div>
      <div className="sec">
        <h2 className="sec-h">Back up and restore</h2>
        <div className="data-actions">
          <a className="btn" href="/api/export" download>Export progress (JSON)</a>
          <label className="btn ghost" style={{ cursor: "pointer" }}>
            Import a file…
            <input type="file" accept="application/json,.json" hidden onChange={e => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className="notice">{msg}</p>}
      </div>
      <div className="sec">
        <h2 className="sec-h">Bringing progress from the old console</h2>
        <p className="sec-s">The old single-file version stored progress in your claude.ai account (published page) or in that browser (offline file). Its format is accepted here as-is: open the old page, run <code>copy(localStorage.getItem("apc.progress.v1"))</code> in the browser console, save the clipboard to a <code>.json</code> file, and import it above. Item ids are unchanged, so everything lines up.</p>
      </div>
    </div>
  );
}
