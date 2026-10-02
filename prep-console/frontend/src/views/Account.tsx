import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { call } from "../api";
import { useAuth } from "../auth";
import { browserCopy, useProgress } from "../store";
import { Avatar } from "../components/Avatar";

const PROVIDER: Record<string, string> = { google: "Google", github: "GitHub", dev: "Dev login" };

/** Profile, backup and restore, and the controls that delete things. */
export function Account() {
  const { status, user, signOut, expired } = useAuth();
  const { state, mode, importState, resetProgress } = useProgress();
  const nav = useNavigate();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const old = mode === "server" ? browserCopy() : null;
  const counts = {
    statuses: Object.keys(state.items).length,
    cards: Object.keys(state.srs).length,
    days: Object.keys(state.days).length,
    mocks: state.logs.length,
  };

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true); setMsg("");
    try { const m = await fn(); if (m) setMsg(m); } catch (e) { setMsg(`Something went wrong: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const onFile = (f: File | undefined) => f && run(async () => importState(JSON.parse(await f.text())));
  const onReset = () => {
    if (!window.confirm("Clear all your progress â€” statuses, flashcards, streak and mock history? This cannot be undone.")) return;
    void run(async () => { await resetProgress(); return "Progress cleared."; });
  };
  const onDelete = () => {
    if (!user || window.prompt(`This deletes your account and all progress. Type your email (${user.email}) to confirm.`) !== user.email) return;
    void run(async () => { await call("DELETE", "/api/account"); expired(); nav("/"); });
  };

  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      <div className="eyebrow">Workspace</div>
      <h1 className="page-h">Account &amp; data</h1>

      {status === "signed-in" && user ? (
        <div className="card profile">
          <Avatar user={user} size={56} />
          <div className="profile-b">
            <div className="profile-n">{user.name || user.email}{user.admin && <span className="badge">Admin</span>}</div>
            <div className="profile-e">{user.email}</div>
            <div className="profile-p">Signed in with {PROVIDER[user.provider] || user.provider}</div>
          </div>
          <button className="btn ghost" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      ) : (
        <p className="lede">The server is unreachable, so progress is being saved in this browser only. Start the backend and sign in to keep it in your account.</p>
      )}

      <div className="grid g4" style={{ marginTop: 18 }}>
        <div className="stat lead"><span className="k">Storage</span><span className="v" style={{ fontSize: 22 }}>{mode === "server" ? "Account" : mode === "local" ? "Browser" : "â€¦"}</span>
          <span className="d">{mode === "server" ? "synced to the server" : mode === "local" ? "this browser only" : "connecting"}</span></div>
        <div className="stat"><span className="k">Marked items</span><span className="v">{counts.statuses}</span><span className="d">done or flagged</span></div>
        <div className="stat"><span className="k">Flashcards</span><span className="v">{counts.cards}</span><span className="d">scheduled</span></div>
        <div className="stat"><span className="k">Mock sessions</span><span className="v">{counts.mocks}</span><span className="d">{counts.days} active day{counts.days === 1 ? "" : "s"}</span></div>
      </div>

      {old && (
        <div className="acct-callout">
          <div><b>Progress found in this browser.</b> It was saved here before you signed in ({Object.keys(old.items).length} items, {old.logs.length} mock sessions). Add it to your account?</div>
          <button className="btn" type="button" disabled={busy} onClick={() => run(async () => {
            const m = await importState(old);
            try { localStorage.removeItem("apc.progress.v2"); } catch { /* ignore */ }
            return m;
          })}>Import it</button>
        </div>
      )}

      <div className="sec">
        <h2 className="sec-h">Back up and restore</h2>
        <p className="sec-s">Export downloads your progress as a JSON file. Import merges a file into what is already there; nothing is overwritten except statuses and flashcard schedules for the same items.</p>
        <div className="data-actions">
          {mode === "server"
            ? <a className="btn" href="/api/export" download>Export progress (JSON)</a>
            : <button className="btn" type="button" onClick={() => download(state)}>Export progress (JSON)</button>}
          <label className={`btn ghost${mode !== "server" ? " disabled" : ""}`} style={{ cursor: mode === "server" ? "pointer" : "not-allowed" }}>
            Import a fileâ€¦
            <input type="file" accept="application/json,.json" hidden disabled={mode !== "server" || busy} onChange={e => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className="notice" role="status">{msg}</p>}
      </div>

      <div className="sec">
        <h2 className="sec-h">Bringing progress from the old console</h2>
        <p className="sec-s">The old single-file console's format is accepted as-is: open the old page, run <code>copy(localStorage.getItem("apc.progress.v1"))</code> in the browser console, save the clipboard to a <code>.json</code> file, and import it above. Item ids are unchanged, so everything lines up.</p>
      </div>

      <div className="sec danger">
        <h2 className="sec-h">Danger zone</h2>
        <div className="danger-row">
          <div><b>Clear progress</b><small>Statuses, flashcards, streak and mock history. Your account stays.</small></div>
          <button className="btn ghost warn" type="button" disabled={busy} onClick={onReset}>Clear progress</button>
        </div>
        {status === "signed-in" && (
          <div className="danger-row">
            <div><b>Delete account</b><small>Removes your account and everything in it. An admin would need to invite you again only if your invite was removed.</small></div>
            <button className="btn crit" type="button" disabled={busy} onClick={onDelete}>Delete account</button>
          </div>
        )}
      </div>
    </div>
  );
}

function download(state: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `prep-progress-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
}
