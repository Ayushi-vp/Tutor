/* The page tutor: Markdown answers, the panel, streaming, notes, and the highlight toolbar. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { Markdown } from "../markdown";

const offline = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = offline; localStorage.clear(); window.getSelection()?.removeAllRanges(); });

const member = { id: 2, email: "friend@example.com", name: "Friend", avatar: "", provider: "google", admin: false };
const EMPTY_STATE = { items: {}, days: {}, srs: {}, notes: {}, logs: [] };

function sse(events: [string, unknown][]): Response {
  const body = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

/** A signed-in server whose tutor answers in two pieces. Records every request. */
function tutorServer(opts: { enabled?: boolean; ask?: () => Response } = {}) {
  const calls: { method: string; url: string; body: Record<string, unknown> | undefined }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
    if (url === "/api/me") return json(200, member);
    if (url === "/api/state") return json(200, EMPTY_STATE);
    if (url === "/api/chat/config") return json(200, { enabled: opts.enabled ?? true, model: "test-model", limit: 50, used: 3 });
    if (url.startsWith("/api/chat/threads")) return json(200, []);
    if (url === "/api/chat" && method === "POST") {
      return opts.ask ? opts.ask() : sse([["meta", { threadId: 7, itemId: body?.itemId ?? "", questionId: 1 }],
        ["delta", { t: "**Encapsulation** wraps " }], ["delta", { t: "each layer.\n\n- one\n- two" }], ["done", { answerId: 2 }]]);
    }
    if (url.startsWith("/api/notes/")) return json(200, { ok: true });
    return json(404, { error: "not found" });
  }) as typeof fetch;
  return calls;
}

async function renderAt(route: string) {
  const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /></MemoryRouter>);
  await act(async () => {});
  await act(async () => {});
  return r;
}

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => {}); };

describe("Markdown answers", () => {
  it("renders the formatting the tutor uses", () => {
    const { container } = render(<Markdown text={"# Title\n\nSome **bold** and `code`.\n\n1. first\n2. second\n\n```python\nx = 1\n```"} />);
    expect(container.querySelector("h3")?.textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("p code")?.textContent).toBe("code");
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelector("pre[data-lang=python]")?.textContent).toBe("x = 1");
  });

  it("never turns model output into markup", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> [a](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });
});

describe("tutor panel", () => {
  it("opens from the floating button and explains when offline", async () => {
    await renderAt("/ts");
    fireEvent.click(screen.getByLabelText(/Ask the tutor/));
    await settle();
    expect(screen.getByRole("complementary", { name: "Tutor" })).toBeTruthy();
    expect(screen.getByText(/needs a connection to the server/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close tutor"));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
  });

  it("Ctrl+K toggles the panel", async () => {
    tutorServer();
    await renderAt("/ts");
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await settle();
    expect(screen.getByRole("complementary", { name: "Tutor" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
  });

  it("asks about a topic, streams the answer and saves it to notes", async () => {
    const calls = tutorServer();
    await renderAt("/ts?open=ts1");
    fireEvent.click(screen.getAllByText("Ask the tutor")[0]);
    await settle();
    const panel = screen.getByRole("complementary", { name: "Tutor" });
    expect(panel.querySelector(".tchip-t")?.textContent).toMatch(/\S/);
    expect(screen.getByText("47 of 50 left today")).toBeTruthy();

    fireEvent.click(screen.getByText("What do interviewers usually ask about this?"));
    await settle();
    const post = calls.find(c => c.url === "/api/chat")!;
    expect(post.body).toMatchObject({ question: "What do interviewers usually ask about this?", itemId: "ts1" });
    expect(panel.querySelector(".tmsg-a strong")?.textContent).toBe("Encapsulation");
    expect(panel.querySelectorAll(".tmsg-a li")).toHaveLength(2);

    fireEvent.click(screen.getByText("Add to notes"));
    await settle();
    expect(screen.getByText("Added to notes ✓")).toBeTruthy();
    const put = calls.find(c => c.url === "/api/notes/ts1")!;
    expect(String(put.body?.text)).toMatch(/^Tutor — What do interviewers usually ask about this\?\n\*\*Encapsulation\*\*/);
    expect((screen.getAllByLabelText("My notes")[0] as HTMLTextAreaElement).value).toContain("each layer.");
  });

  it("follow-ups continue the same chat", async () => {
    const calls = tutorServer();
    await renderAt("/ts?open=ts1");
    fireEvent.click(screen.getAllByText("Ask the tutor")[0]);
    await settle();
    const box = screen.getByLabelText("Your question");
    fireEvent.change(box, { target: { value: "first" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await settle();
    fireEvent.change(box, { target: { value: "second" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await settle();
    const posts = calls.filter(c => c.url === "/api/chat");
    expect(posts.map(p => p.body?.threadId)).toEqual([undefined, 7]);
  });

  it("shows the server's reason when a question is refused", async () => {
    tutorServer({ ask: () => new Response(JSON.stringify({ error: "You have used all 50 tutor questions for today." }), { status: 429 }) });
    await renderAt("/ts?open=ts1");
    fireEvent.click(screen.getAllByText("Ask the tutor")[0]);
    await settle();
    fireEvent.click(screen.getByText("Quiz me on this topic, one question at a time"));
    await settle();
    expect(screen.getByRole("alert").textContent).toMatch(/used all 50/);
  });

  it("tells members when the tutor is not set up", async () => {
    tutorServer({ enabled: false });
    await renderAt("/ts");
    fireEvent.click(screen.getByLabelText(/Ask the tutor/));
    await settle();
    expect(screen.getByText(/not available on this server yet/)).toBeTruthy();
    expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).disabled).toBe(true);
  });
});

describe("highlighting text", () => {
  function select(el: Element) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it("offers quick actions that ask about the passage and its topic", async () => {
    const calls = tutorServer();
    const { container } = await renderAt("/ts?open=ts1");
    const para = container.querySelector("#ts1 .topic-b p")!;
    select(para);
    fireEvent.pointerUp(para);
    await act(() => new Promise(r => setTimeout(r, 20)));   // the toolbar appears once the selection settles
    const bar = screen.getByRole("toolbar", { name: /highlighted text/ });
    fireEvent.click(bar.querySelector("button")!);   // Explain
    await settle();
    const post = calls.find(c => c.url === "/api/chat")!;
    expect(post.body).toMatchObject({ itemId: "ts1", selection: para.textContent!.trim() });
    expect(String(post.body?.question)).toMatch(/^Explain/);
    expect(container.querySelector(".tmsg-q")?.textContent).toBe(para.textContent!.trim().slice(0, 280) + (para.textContent!.trim().length > 280 ? "…" : ""));
  });

  it("right-click on the highlight opens the tutor menu; Shift keeps the browser's", async () => {
    tutorServer();
    const { container } = await renderAt("/ts?open=ts1");
    const para = container.querySelector("#ts1 .topic-b p")!;
    select(para);
    fireEvent.contextMenu(para, { clientX: 350, clientY: 310, shiftKey: true });
    expect(screen.queryByRole("menu", { name: "Ask the tutor" })).toBeNull();
    fireEvent.contextMenu(para, { clientX: 350, clientY: 310 });
    await settle();
    expect(screen.getByRole("menu", { name: "Ask the tutor" })).toBeTruthy();
    fireEvent.click(screen.getByText("Ask a question…"));
    await settle();
    expect(screen.getByText("Asking about")).toBeTruthy();
  });
});
