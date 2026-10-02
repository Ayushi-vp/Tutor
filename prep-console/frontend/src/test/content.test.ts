/* Content integrity — the checks the old build ran in src/tools/check.js. */
import { describe, expect, it } from "vitest";
import { ALL_IDS, BANK, DESIGNS, ITEM_INDEX, ROUNDS, TRACKS, VIEWS, type Item } from "../content";
import { VIZ } from "../legacy/viz.js";

const items: [string, Item[]][] = [...Object.entries(TRACKS), ...Object.entries(DESIGNS)];

describe("content", () => {
  it("has no duplicate tracked ids or bank ids", () => {
    const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    expect(dup(ALL_IDS)).toEqual([]);
    expect(dup(BANK.map(b => b.id))).toEqual([]);
  });

  it.each(items)("%s: quick checks and sources are well formed", (_, list) => {
    for (const t of list) {
      for (const r of t.qa || []) {
        expect([3, 4], `${t.id} qa`).toContain(r.length);
        expect(["E", "M", "H"], `${t.id} difficulty`).toContain(r[0]);
      }
      for (const r of t.refs || []) {
        expect(r, `${t.id} ref`).toHaveLength(4);
        expect(r[3], `${t.id} ref url`).toMatch(/^https:\/\//);
      }
      if (t.viz) expect(VIZ[t.viz], `${t.id} viz "${t.viz}"`).toBeDefined();
      if (t.drill) expect(t.drill, `${t.id} drill needs an answer`).toContain("<details>");
      for (const r of t.myths || []) expect(r, `${t.id} myth`).toHaveLength(2);
      for (const r of t.glossary || []) expect(r, `${t.id} glossary`).toHaveLength(2);
      for (const r of t.prereq || []) expect(ITEM_INDEX[r[0]], `${t.id} prereq ${r[0]}`).toBeDefined();
    }
  });

  it("every design has a primer and a senior layer", () => {
    for (const [k, list] of Object.entries(DESIGNS)) for (const d of list) {
      expect(d.primer, `${k}/${d.id} primer`).toBeTruthy();
      expect(d.deep, `${k}/${d.id} deep`).toBeTruthy();
    }
  });

  it("every ML coding problem has a runnable solution and checks", () => {
    // scripts/check_mlc.py executes these blocks; here we only make sure they exist.
    for (const d of DESIGNS.mlc) {
      expect(d.body.split('<pre class="run">').length - 1, `${d.id} runnable blocks`).toBeGreaterThanOrEqual(2);
      expect(d.drill, `${d.id} exercise`).toContain('<pre class="run">');
    }
  });

  it("every section has page text and every bank round has questions", () => {
    for (const k of [...Object.keys(TRACKS), ...Object.keys(DESIGNS)]) expect(VIEWS[k], k).toBeDefined();
    for (const r of ROUNDS) if (r.draw.type === "bank") {
      const cats = r.draw.cats;
      expect(BANK.filter(b => cats.includes(b.cat)).length, r.id).toBeGreaterThanOrEqual(r.draw.n);
    }
  });

  it("never loses the curriculum the old console had", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(446);
    expect(ALL_IDS.length).toBeGreaterThanOrEqual(703);
  });
});
