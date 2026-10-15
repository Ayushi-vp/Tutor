/* The learning map: every track forms a proper tree, states follow prerequisites, next steps make sense. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { TRACKS } from "../content";
import type { Status } from "../store";
import { TREE_VIEWS, nextSteps, stateOf, treeOf } from "../tree";

afterEach(() => { cleanup(); localStorage.clear(); });

const statusFrom = (done: string[], rev: string[] = []) => (id: string): Status | null =>
  done.includes(id) ? "done" : rev.includes(id) ? "rev" : null;

describe("trees", () => {
  it.each(TREE_VIEWS.map(x => x.v))("%s: every topic is placed, after everything it builds on", v => {
    const tree = treeOf(v);
    const placed = tree.stages.flat();
    expect(placed.sort()).toEqual(Object.keys(tree.nodes).sort());
    expect(tree.stages[0].length).toBeGreaterThan(0);
    for (const n of Object.values(tree.nodes)) {
      for (const p of n.pre) {
        expect(tree.nodes[p].stage, `${n.id} builds on ${p}`).toBeLessThan(n.stage);
        expect(tree.nodes[p].unlocks).toContain(n.id);
      }
      // Drawn links are a subset of the prerequisites that still reaches all of them.
      expect(n.pre).toEqual(expect.arrayContaining(n.links));
      const reach = new Set<string>();
      const walk = (id: string) => tree.nodes[id].links.forEach(l => { if (!reach.has(l)) { reach.add(l); walk(l); } });
      walk(n.id);
      for (const p of n.pre) expect(reach.has(p), `${n.id} still reaches ${p}`).toBe(true);
      if (n.stage > 0) expect(n.pre.length).toBeGreaterThan(0);
    }
  });

  it("a topic is ready once its in-track prerequisites are done", () => {
    const tree = treeOf("net");
    const child = Object.values(tree.nodes).find(n => n.pre.length >= 2)!;
    expect(stateOf(child, statusFrom([]))).toBe("locked");
    expect(stateOf(child, statusFrom(child.pre.slice(1)))).toBe("locked");
    expect(stateOf(child, statusFrom(child.pre))).toBe("ready");
    expect(stateOf(child, statusFrom([...child.pre, child.id]))).toBe("done");
    expect(stateOf(child, statusFrom(child.pre, [child.id]))).toBe("rev");
    // A prerequisite flagged for a second pass has been studied: it does not lock what follows.
    expect(stateOf(child, statusFrom(child.pre.slice(1), [child.pre[0]]))).toBe("ready");
  });
});

describe("next steps", () => {
  it("a new learner gets the starting topics of different tracks", () => {
    const steps = nextSteps(statusFrom([]), 3);
    expect(steps).toHaveLength(3);
    for (const s of steps) expect(treeOf(s.view).nodes[s.id].stage).toBe(0);
    expect(steps[0].why).toMatch(/^Start of /);
  });

  it("continues the track you started with a topic you have unlocked", () => {
    const net = treeOf("net");
    const root = net.stages[0][0];
    const steps = nextSteps(statusFrom([root]), 3);
    expect(steps[0].view).toBe("net");
    expect(net.nodes[steps[0].id].pre.every(p => p === root)).toBe(true);
    expect(steps[0].why).toMatch(/^Continue Networking · 1\/\d+ done/);
    expect(steps.filter(s => s.view === "net").length).toBeLessThanOrEqual(2);
    expect(steps.some(s => s.id === root)).toBe(false);
  });
});

describe("on the home page", () => {
  async function home(done: string[] = []) {
    localStorage.setItem("apc.progress.v2", JSON.stringify({ items: Object.fromEntries(done.map(id => [id, "done"])) }));
    const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/"]}><App /></MemoryRouter>);
    for (let i = 0; i < 4; i++) await act(async () => {});
    return r;
  }

  it("shows the track you are furthest into, with done, ready and next marked", async () => {
    const root = treeOf("ts").stages[0][0];
    const { container } = await home([root]);
    const pick = screen.getByLabelText("Track to show as a tree") as HTMLSelectElement;
    expect(pick.value).toBe("ts");
    expect(container.querySelectorAll(".stree .snode")).toHaveLength(TRACKS.ts.length);
    expect(container.querySelector(`.snode.done[data-node="${root}"]`)).not.toBeNull();
    expect(container.querySelectorAll(".snode.ready").length).toBeGreaterThan(0);
    expect(container.querySelector(".snode.next.ready")).not.toBeNull();
    expect(container.querySelector(".nextrow b")?.textContent).toBe(treeOf("ts").nodes[nextSteps(statusFrom([root]), 1)[0].id].t);
  });

  it("switches tracks and links each topic to its lesson", async () => {
    const { container } = await home();
    fireEvent.change(screen.getByLabelText("Track to show as a tree"), { target: { value: "net" } });
    const nodes = container.querySelectorAll<HTMLAnchorElement>(".stree .snode");
    expect(nodes).toHaveLength(TRACKS.net.length);
    expect(nodes[0].getAttribute("href")).toMatch(/^\/net\/net\d+$/);
    expect(localStorage.getItem("apc.tree.view")).toBe("net");
  });
});
