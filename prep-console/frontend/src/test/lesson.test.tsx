/* The focused lesson page, copy buttons on code, and reading settings. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { TRACKS } from "../content";
import { lessonPath, readingMinutes } from "../lesson";

afterEach(() => { cleanup(); localStorage.clear(); });

let path = "";
function Where() { path = useLocation().pathname; return null; }

async function open(route: string) {
  const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /><Where /></MemoryRouter>);
  await act(async () => {});
  return r;
}

describe("lesson page", () => {

  it("renders a topic with its title, reading time and contents", async () => {
    const t = TRACKS.ts[0];
    const { container } = await open(`/ts/${t.id}`);
    expect(container.querySelector("h1")?.textContent).toBe(t.t);
    expect(screen.getAllByText(`${readingMinutes(t)} min read`).length).toBeGreaterThan(0);
    const toc = container.querySelector(".ltoc .toc");
    expect(toc?.querySelectorAll("a").length).toBeGreaterThan(2);
    expect(toc?.textContent).toContain("The lesson");
    expect(container.querySelector(`.topic.lesson-doc[id="${t.id}"] .topic-b`)).not.toBeNull();
  });

  it("an unknown lesson id goes back to its track", async () => {
    await open("/ts/nope");
    expect(path).toBe("/ts");
  });

  it("'mark learned and continue' marks it done and opens the next lesson", async () => {
    const [a, b] = TRACKS.ts;
    await open(lessonPath(a.id));
    fireEvent.click(screen.getByText(/Mark learned and continue/));
    await act(async () => {});
    expect(path).toBe(`/ts/${b.id}`);
    expect(screen.getByText(/← Previous/).closest("a")?.getAttribute("href")).toBe(`/ts/${a.id}`);
    expect(JSON.parse(localStorage.getItem("apc.progress.v2")!).items[a.id]).toBe("done");
  });

  it("the last lesson offers to finish the track", async () => {
    const last = TRACKS.ts[TRACKS.ts.length - 1];
    await open(lessonPath(last.id));
    expect(screen.getByText(/Mark learned and finish the track/)).toBeTruthy();
    expect(screen.getByText("End of track")).toBeTruthy();
  });

  it("an open card in the track links to the full page", async () => {
    await open("/ts?open=ts1");
    expect(screen.getByText("Read as a full page").closest("a")?.getAttribute("href")).toBe("/ts/ts1");
  });
});

describe("code blocks", () => {
  it("get a copy button that copies the code", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = await open("/py/py1");
    const btn = container.querySelector<HTMLButtonElement>(".codewrap .copy-code");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("");   // icon only: nothing for pins or the tutor to pick up
    await act(async () => { btn!.click(); });
    expect(writeText).toHaveBeenCalledWith(btn!.parentElement!.querySelector("pre")!.textContent);
  });
});

describe("reading settings", () => {
  it("text size and width set CSS variables and are remembered", async () => {
    await open("/ts/ts1");
    fireEvent.click(screen.getByLabelText("Reading settings", { selector: "button" }));
    fireEvent.click(screen.getByText("XL"));
    fireEvent.click(screen.getByText("Wide"));
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--read-scale")).toBe("1.22");
    expect(root.getPropertyValue("--measure")).toBe("86ch");
    expect(JSON.parse(localStorage.getItem("apc.reading")!)).toEqual({ size: "xl", width: "wide" });
    fireEvent.click(screen.getByText("Reset to default"));
    expect(root.getPropertyValue("--read-scale")).toBe("1");
  });
});
