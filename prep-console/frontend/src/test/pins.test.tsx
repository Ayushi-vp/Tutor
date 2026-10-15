/* Tutor answers pinned beside the passage they explain. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { anchorOf, markPassage, unmarkAll } from "../anchor";
import { App } from "../App";
import { TRACKS } from "../content";

const offline = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = offline; localStorage.clear(); window.getSelection()?.removeAllRanges(); });

function lesson(html: string) {
  const root = document.createElement("div");
  root.className = "topic-b";
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe("finding a passage", () => {
  it("matches across inline tags, paragraphs and different whitespace", () => {
    const root = lesson("<p>The <b>quick</b>\n   brown fox.</p><p>Jumps over.</p>");
    const marks = markPassage(root, 1, "quick brown fox.\n\nJumps", { prefix: "", suffix: "" });
    expect(marks.map(m => m.textContent).join("|")).toBe("quick|brown fox.|Jumps");
    expect(root.textContent).toBe("The quick\n   brown fox.Jumps over.");
    root.remove();
  });

  it("uses the surrounding text to pick the right occurrence", () => {
    const root = lesson("<p>a cache hit here</p><p>the cache hit there</p>");
    const [mark] = markPassage(root, 2, "cache hit", { prefix: "the ", suffix: " there" });
    expect(mark.parentElement!.textContent).toBe("the cache hit there");
    root.remove();
  });

  it("undoes every mark exactly", () => {
    const html = "<p>one <i>two</i> three</p><ul><li>four five</li></ul>";
    const root = lesson(html);
    markPassage(root, 1, "two three", { prefix: "", suffix: "" });
    markPassage(root, 2, "five", { prefix: "", suffix: "" });
    expect(root.querySelectorAll("mark")).toHaveLength(3);
    unmarkAll(root);
    expect(root.innerHTML).toBe(html);
    root.remove();
  });

  it("ignores figures and notes, and reports a passage that is gone", () => {
    const root = lesson('<p>visible</p><svg><text>hidden words</text></svg><div class="mynotes">hidden words</div>');
    expect(markPassage(root, 1, "hidden words", { prefix: "", suffix: "" })).toEqual([]);
    expect(markPassage(root, 1, "not there", { prefix: "", suffix: "" })).toEqual([]);
    root.remove();
  });

  it("records the text around a selection", () => {
    const root = lesson("<p>before the passage after</p>");
    const text = root.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 7);
    range.setEnd(text, 18);
    expect(range.toString()).toBe("the passage");
    expect(anchorOf(range, root)).toEqual({ prefix: "before ", suffix: " after" });
    root.remove();
  });
});

// ---------------------------------------------------------------- in the app

const member = { id: 2, email: "friend@example.com", name: "Friend", avatar: "", provider: "google", admin: false };
const firstPara = new DOMParser().parseFromString(TRACKS.ts[0].body, "text/html").querySelector("p")!.textContent!;
const QUOTE = firstPara.slice(0, 48).trim();
const PIN = { id: 5, item_id: "ts1", quote: QUOTE, prefix: "", suffix: "", question: "Explain this passage in plain words: what it means and why it matters.",
  answer: "It means **this**.", thread_id: null, created_at: 1790000000 };

function server(pins: unknown[]) {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
    if (url === "/api/me") return json(200, member);
    if (url === "/api/state") return json(200, { items: {}, days: {}, srs: {}, notes: {}, logs: [] });
    if (url === "/api/pins" && method === "GET") return json(200, pins);
    if (url === "/api/pins" && method === "POST") return json(201, { ...body, id: 9, item_id: body!.itemId, thread_id: body!.threadId, created_at: 1790000000 });
    if (url.startsWith("/api/pins/") && method === "DELETE") return json(200, { ok: true });
    if (url === "/api/chat/config") return json(200, { enabled: true, model: "m", limit: null, used: 0 });
    if (url.startsWith("/api/chat/threads")) return json(200, []);
    if (url === "/api/chat") {
      const ev = (e: string, d: unknown) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
      return new Response(ev("meta", { threadId: 3, itemId: "ts1", questionId: 1 }) + ev("delta", { t: "A pinned answer." }) + ev("done", { answerId: 2 }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    return json(404, { error: "not found" });
  }) as typeof fetch;
  return calls;
}

async function renderAt(route: string) {
  const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /></MemoryRouter>);
  for (let i = 0; i < 6; i++) await act(async () => {});
  return r;
}

describe("pins in a lesson", () => {
  it("highlights the passage and shows the answer under its paragraph", async () => {
    const calls = server([PIN]);
    const { container } = await renderAt("/ts?open=ts1");
    const mark = container.querySelector<HTMLElement>('#ts1 mark.pin-mark[data-pin="5"]')!;
    expect(mark).not.toBeNull();
    expect(container.querySelector("#ts1 .pin-chip")?.textContent).toBe("1 pinned");
    const card = container.querySelector('#ts1 .pin-slot [data-pin-card="5"]')!;
    expect(card.querySelector(".pin-q")?.textContent).toBe("Explain");
    expect(card.querySelector(".pin-body")).toBeNull();

    fireEvent.click(mark);
    await act(async () => {});
    expect(card.querySelector(".pin-body strong")?.textContent).toBe("this");
    expect(mark.classList.contains("on")).toBe(true);

    fireEvent.click(screen.getByText("Remove pin"));
    for (let i = 0; i < 3; i++) await act(async () => {});
    expect(calls.some(c => c.method === "DELETE" && c.url === "/api/pins/5")).toBe(true);
    expect(container.querySelector("#ts1 mark.pin-mark")).toBeNull();
    expect(container.querySelector("#ts1 .pin-slot")).toBeNull();
  });

  it("keeps a pin whose passage was edited out, at the end of the topic", async () => {
    server([{ ...PIN, quote: "a sentence that is no longer in the lesson" }]);
    const { container } = await renderAt("/ts?open=ts1");
    expect(container.querySelector("#ts1 mark.pin-mark")).toBeNull();
    expect(screen.getByText("Pinned answers whose passage has changed")).toBeTruthy();
  });

  it("pins a tutor answer from a highlight", async () => {
    const calls = server([]);
    const { container } = await renderAt("/ts?open=ts1");
    const para = [...container.querySelectorAll("#ts1 .topic-b .prose p")].find(p => p.textContent!.includes(QUOTE))!;
    const range = document.createRange();
    range.selectNodeContents(para);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.pointerUp(para);
    await act(() => new Promise(r => setTimeout(r, 20)));
    fireEvent.click(screen.getByRole("toolbar", { name: /highlighted text/ }).querySelector("button")!);
    for (let i = 0; i < 6; i++) await act(async () => {});

    fireEvent.click(screen.getByText("Pin to lesson"));
    for (let i = 0; i < 6; i++) await act(async () => {});
    const post = calls.find(c => c.method === "POST" && c.url === "/api/pins")!;
    expect(post.body).toMatchObject({ itemId: "ts1", quote: para.textContent!.trim(), answer: "A pinned answer.", threadId: 3 });
    expect(typeof post.body!.prefix).toBe("string");
    expect(screen.getByText("Pinned ✓ · show in lesson")).toBeTruthy();
    expect(container.querySelector('#ts1 mark.pin-mark[data-pin="9"]')).not.toBeNull();
  });
});
