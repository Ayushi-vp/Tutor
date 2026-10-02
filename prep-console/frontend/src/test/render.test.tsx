/* Every page renders, and every figure draws, without throwing. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { mountViz, VIZ, vizHTML } from "../legacy/viz.js";

afterEach(cleanup);

const routes = ["/", "/roadmap", "/mock", "/cards", "/data", "/dsa", "/bank", "/search?q=attention",
  "/ml", "/dl", "/llm", "/aieng", "/ts", "/swe", "/gpu", "/rs", "/mm", "/net", "/scale", "/py", "/classic", "/infra", "/hld", "/lld", "/mlc"];

describe("pages", () => {
  it.each(routes)("%s renders", async route => {
    const { container } = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /></MemoryRouter>);
    await act(async () => {});
    expect(container.querySelector("h1")?.textContent?.length).toBeGreaterThan(3);
  });

  it("deep link opens the topic and mounts its figure", async () => {
    const { container } = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ts?open=ts3"]}><App /></MemoryRouter>);
    await act(async () => {});
    expect(container.querySelector('[data-viz="tsAcf"] svg')).not.toBeNull();
  });

  it("marking a topic done updates the progress count", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ts?open=ts1"]}><App /></MemoryRouter>);
    await act(async () => {});
    expect(screen.getByText("0/12 learned")).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText("Mark done")[0]);
    expect(screen.getByText("1/12 learned")).toBeTruthy();
  });

  it("the ML coding round draws one problem plus follow-ups", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mock"]}><App /></MemoryRouter>);
    await act(async () => {});
    fireEvent.click(screen.getByText("ML coding", { selector: ".card-t" }));
    expect(document.querySelectorAll(".qcard").length).toBe(4);
  });

  it("a mock round starts and draws questions", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mock"]}><App /></MemoryRouter>);
    await act(async () => {});
    fireEvent.click(screen.getByText("Time series & forecasting"));
    expect(document.querySelectorAll(".qcard").length).toBe(6);
  });
});

describe("figures", () => {
  it.each(Object.keys(VIZ))("%s draws", key => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.innerHTML = vizHTML(key);
    expect(el.innerHTML.length).toBeGreaterThan(200);
    mountViz(el);
    el.remove();
  });
});
