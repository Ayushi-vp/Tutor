import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BANK, CATS } from "../content";
import { useProgress } from "../store";
import { DIFF_CLS, DIFF_NAME, shuffle, todayKey } from "../util";

/** Leitner boxes: how many days until a card in box n comes back. */
const BOX_DAYS = [0, 1, 3, 7, 16, 35];

interface Deck { ids: string[]; i: number; shown: boolean; right: number; cat: string }

export function Cards() {
  const { state, setSrs, setStatus, get } = useProgress();

  const due = () => BANK.filter(b => {
    const s = state.srs[b.id];
    return s ? s.due <= todayKey() : get(b.id) !== "done";
  });
  const build = (cat: string): Deck => {
    let pool = due().filter(b => !cat || b.cat === cat);
    if (!pool.length) pool = BANK.filter(b => !cat || b.cat === cat);
    return { ids: shuffle(pool).slice(0, 20).map(b => b.id), i: 0, shown: false, right: 0, cat };
  };
  const [deck, setDeck] = useState<Deck>(() => build(""));

  const grade = (g: "again" | "hard" | "good") => {
    const id = deck.ids[deck.i];
    const box0 = state.srs[id]?.box || 0;
    const box = g === "again" ? 1 : g === "hard" ? Math.max(1, box0) : Math.min(5, box0 + 1);
    setSrs(id, box, new Date(Date.now() + BOX_DAYS[box] * 864e5).toISOString().slice(0, 10));
    if (box >= 4) setStatus(id, "done"); else if (g === "again") setStatus(id, "rev");
    setDeck(d => ({ ...d, i: d.i + 1, shown: false, right: d.right + (g === "good" ? 1 : 0) }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && !/^(INPUT|TEXTAREA)$/.test((document.activeElement as HTMLElement)?.tagName)) {
        e.preventDefault(); setDeck(d => (d.i < d.ids.length ? { ...d, shown: true } : d));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const done = deck.i >= deck.ids.length;
  const b = done ? null : BANK.find(x => x.id === deck.ids[deck.i])!;
  const mastered = BANK.filter(x => (state.srs[x.id]?.box || 0) >= 4).length;

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <div className="eyebrow">Drill · recall</div>
      <h1 className="page-h">Flashcards</h1>
      <p className="lede">Answer out loud before you reveal — recognising an answer is not the same as producing one. Cards you grade “again” come back today; cards you keep getting right drift out to five weeks.</p>
      <div className="filters" style={{ marginTop: 20 }}>
        <label>Deck</label>
        <button className="pill-btn" type="button" aria-pressed={deck.cat === ""} onClick={() => setDeck(build(""))}>Everything</button>
        {Object.keys(CATS).map(c => <button key={c} className="pill-btn" type="button" aria-pressed={deck.cat === c} onClick={() => setDeck(build(c))}>{CATS[c]}</button>)}
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)" }}>{mastered} mastered · {due().length} due</span>
      </div>
      {!b ? (
        <div className="fcard" style={{ justifyContent: "center", textAlign: "center" }}>
          <div className="fq">Deck finished</div>
          <p style={{ color: "var(--ink-2)", fontSize: 14.5 }}>{deck.right} of {deck.ids.length} graded as known. Cards you struggled with are scheduled to return.</p>
          <div className="fcontrols" style={{ justifyContent: "center" }}>
            <button className="btn" type="button" onClick={() => setDeck(build(deck.cat))}>Shuffle a new deck</button>
            <Link className="btn ghost" to="/bank">Browse the bank</Link>
          </div>
        </div>
      ) : (<>
        <div className="fcard">
          <div className="fmeta"><span className="tag">{CATS[b.cat]}</span><span className={`chip ${DIFF_CLS[b.d]}`}>{DIFF_NAME[b.d]}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
              {deck.i + 1} / {deck.ids.length}{state.srs[b.id] ? ` · box ${state.srs[b.id].box}` : " · new"}</span></div>
          <div className="fq">{b.q}</div>
          {deck.shown ? <div className="fa">{b.a}</div> : <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: "auto" }}>Say your answer, then reveal (space).</p>}
        </div>
        <div className="fcontrols">
          {deck.shown ? <>
            <button className="btn ghost" type="button" onClick={() => grade("again")}>Again</button>
            <button className="btn ghost" type="button" onClick={() => grade("hard")}>Hard</button>
            <button className="btn" type="button" onClick={() => grade("good")}>Got it</button>
          </> : <>
            <button className="btn" type="button" onClick={() => setDeck(d => ({ ...d, shown: true }))}>Reveal answer</button>
            <button className="btn ghost" type="button" onClick={() => grade("again")}>Skip — didn't know</button>
          </>}
        </div>
        <div className="deck-bar">{deck.ids.map((_, i) => <i key={i} className={i < deck.i ? "ok" : i === deck.i ? "on" : ""} />)}</div>
      </>)}
    </div>
  );
}
