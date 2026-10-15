/* Topic XP: points by difficulty, derived from saved statuses, with per-track milestones. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { DESIGNS, TRACKS } from "../content";
import { lessonPath } from "../lesson";
import type { Status } from "../store";
import { milestoneOf, nearestMilestone, TOPIC_XP, XP, xpOf } from "../xp";

afterEach(() => { cleanup(); localStorage.clear(); });

const statuses = (m: Record<string, Status>) => (id: string) => m[id] ?? null;

async function open(route: string, items: Record<string, Status> = {}) {
  localStorage.setItem("apc.progress.v2", JSON.stringify({ items }));
  const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /></MemoryRouter>);
  await act(async () => {});
  return r;
}

// ts: 2 easy, 7 medium and 3 hard topics.
const TS_XP = 1400;

describe("xp", () => {
  it("is worth 50, 100 and 200 for easy, medium and hard topics", () => {
    expect(XP).toEqual({ E: 50, M: 100, H: 200 });
    for (const t of TRACKS.ts) expect(TOPIC_XP[t.id], t.id).toBe(XP[t.difficulty!]);
    expect(TOPIC_XP.ts1).toBe(50);
    expect(TOPIC_XP.ts7).toBe(200);
  });

  it("design cases earn none yet", () => {
    for (const d of DESIGNS.hld) expect(TOPIC_XP[d.id]).toBeUndefined();
  });

  it("counts only topics marked done, weighted by difficulty", () => {
    const ids = TRACKS.ts.map(t => t.id);
    expect(xpOf(ids, statuses({}))).toEqual({ earned: 0, available: TS_XP, p: 0 });
    expect(xpOf(ids, statuses({ ts1: "done", ts7: "done", ts3: "rev" })))
      .toEqual({ earned: 250, available: TS_XP, p: 18 });
    expect(xpOf([...ids, "nope"], statuses({ nope: "done" })).earned).toBe(0);
  });

  it("milestones come at the first topic, a quarter, half and all of a track", () => {
    expect(milestoneOf(0, 1000)).toMatchObject({ reached: null, next: { k: "first" }, need: 1 });
    expect(milestoneOf(50, 1000)).toMatchObject({ reached: { k: "first" }, next: { k: "quarter" }, need: 200 });
    expect(milestoneOf(250, 1000)).toMatchObject({ reached: { k: "quarter" }, next: { k: "half" }, need: 250 });
    expect(milestoneOf(999, 1000)).toMatchObject({ reached: { k: "half" }, next: { k: "complete" }, need: 1 });
    expect(milestoneOf(1000, 1000)).toMatchObject({ reached: { k: "complete" }, next: null, need: 0 });
    expect(milestoneOf(0, 0)).toMatchObject({ reached: null, need: 0 });
  });

  it("the nearest milestone is chosen among started tracks only", () => {
    expect(nearestMilestone(statuses({}))).toBeNull();
    expect(nearestMilestone(statuses({ ts1: "done" }))).toMatchObject({ view: "ts", milestone: { k: "quarter" }, need: 300 });
  });
});

describe("xp on screen", () => {
  it("topic cards show difficulty and XP", async () => {
    const { container } = await open("/ts");
    const card = container.querySelector('[id="ts7"]')!;
    expect(card.textContent).toContain("Hard · 200 XP");
  });

  it("a track page shows XP earned and the next milestone", async () => {
    const { container } = await open("/ts?open=ts1");
    const quest = container.querySelector(".quest-card")!;
    expect(quest.textContent).toContain("Not started");
    expect(quest.textContent).toContain("Complete any topic to reach First step");

    fireEvent.click(screen.getAllByLabelText("Mark done")[0]);
    expect(quest.textContent).toContain("First step");
    expect(quest.textContent).toContain(`of ${TS_XP.toLocaleString("en")} XP`);
    expect(quest.textContent).toContain("300 XP to Quarter way");
  });

  it("marking a topic done shows a toast once, and undoing takes the XP back", async () => {
    const { container } = await open("/ts?open=ts1");
    fireEvent.click(screen.getAllByLabelText("Mark done")[0]);
    expect(container.querySelector(".xp-toast")?.textContent).toContain("+50 XP");
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(container.querySelector(".xp-toast")).toBeNull();

    fireEvent.click(screen.getAllByLabelText("Mark done")[0]);
    expect(container.querySelector(".xp-toast")).toBeNull();
    expect(container.querySelector(".quest-card")!.textContent).toContain("Not started");
  });

  it("the lesson page offers the XP on its finish button", async () => {
    await open(lessonPath("ts7"));
    expect(screen.getByText(/Mark learned and continue/).textContent).toContain("+200 XP");
  });

  it("the overview totals XP across tracks and points at the nearest milestone", async () => {
    const { container } = await open("/", { ts1: "done", ts7: "done", ts3: "rev" });
    const card = container.querySelector(".xp-card")!;
    expect(card.querySelector(".v")?.textContent).toMatch(/^250/);
    expect(card.textContent).toContain("100 XP to Quarter way");
  });
});
