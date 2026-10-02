import { ROADMAP, ROADMAP_IDS } from "../content";
import { useProgress } from "../store";

export function Roadmap() {
  const { progressOf, get, setStatus } = useProgress();
  const g = progressOf(ROADMAP_IDS);
  const current = (ROADMAP.find(w => w.items.some(i => get(i[0]) !== "done")) || ROADMAP[ROADMAP.length - 1]).w;
  return (
    <div className="wrap">
      <div className="eyebrow">Plan</div>
      <h1 className="page-h">Eight weeks, in order</h1>
      <p className="lede">Built so each week depends on the last: fundamentals before transformers, transformers before serving, and mocks only once there is something to test. If you have four weeks, do the odd ones.</p>
      <div className="grid g4" style={{ margin: "20px 0 6px" }}>
        <div className="stat lead"><span className="k">Plan progress</span><span className="v">{g.p}<small>%</small></span><span className="d">{g.d} of {g.n} steps</span></div>
        <div className="stat"><span className="k">Current week</span><span className="v">{current}</span><span className="d">of {ROADMAP.length}</span></div>
        <div className="stat"><span className="k">Per week</span><span className="v">4</span><span className="d">focused blocks</span></div>
        <div className="stat"><span className="k">Suggested</span><span className="v">10<small> h</small></span><span className="d">per week, split across days</span></div>
      </div>
      {ROADMAP.map(w => {
        const wg = progressOf(w.items.map(i => i[0]));
        return (
          <div className="week" key={w.w}>
            <div className="week-h">
              <span className="week-n">Week {w.w}</span>
              <span><span className="week-t">{w.t}</span><span className="week-f">{w.focus}</span></span>
              <span className="week-p">{wg.d}/{wg.n}</span>
            </div>
            {w.items.map(([id, label]) => (
              <button className="check" type="button" key={id} aria-pressed={get(id) === "done"}
                onClick={() => setStatus(id, get(id) === "done" ? null : "done")}>
                <span className="box">✓</span><span className="lbl">{label}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
