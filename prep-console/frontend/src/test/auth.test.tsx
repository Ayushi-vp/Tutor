/* The sign-in gate, with the server faked: signed out, signed in as a member, and as an admin. */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";

const offline = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = offline; localStorage.clear(); });

type Handler = (method: string, body: unknown) => [number, unknown];
const EMPTY_STATE = { items: {}, days: {}, srs: {}, notes: {}, logs: [] };

function fakeServer(routes: Record<string, Handler>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    calls.push(`${method} ${url}`);
    const h = routes[`${method} ${url}`] || routes[url];
    const [status, body] = h ? h(method, init?.body ? JSON.parse(String(init.body)) : undefined) : [404, { error: "not found" }];
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

async function renderAt(route: string) {
  const r = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[route]}><App /></MemoryRouter>);
  await act(async () => {});
  await act(async () => {});
  return r;
}

const member = { id: 2, email: "friend@example.com", name: "Friend", avatar: "", provider: "google", admin: false };
const admin = { ...member, id: 1, email: "owner@example.com", name: "Owner", admin: true };

describe("signed out", () => {
  it("shows the landing page with the configured providers", async () => {
    fakeServer({
      "/api/me": () => [401, { error: "sign in required" }],
      "/api/auth/config": () => [200, { providers: ["google", "github"], devLogin: false }],
    });
    await renderAt("/llm");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Prepare for AI-engineer/);
    expect(screen.getByText("Continue with Google").getAttribute("href")).toBe("/auth/login/google");
    expect(screen.getByText("Continue with GitHub").getAttribute("href")).toBe("/auth/login/github");
    expect(screen.queryByText("Dev login")).toBeNull();
  });

  it("explains a rejected sign-in", async () => {
    fakeServer({
      "/api/me": () => [401, {}],
      "/api/auth/config": () => [200, { providers: ["google"], devLogin: false }],
    });
    await renderAt("/?auth=not-invited");
    expect(screen.getByRole("alert").textContent).toMatch(/has not been invited/);
  });

  it("dev login signs in and opens the app", async () => {
    let signedIn = false;
    const calls = fakeServer({
      "/api/me": () => (signedIn ? [200, admin] : [401, {}]),
      "/api/auth/config": () => [200, { providers: [], devLogin: true }],
      "POST /auth/dev-login": (_m, body) => { signedIn = (body as { email: string }).email === admin.email; return signedIn ? [200, { ok: true }] : [403, { error: "not-invited" }]; },
      "/api/state": () => [200, EMPTY_STATE],
    });
    await renderAt("/");
    fireEvent.change(screen.getByLabelText("Email for dev login"), { target: { value: admin.email } });
    await act(async () => { fireEvent.submit(screen.getByLabelText("Email for dev login").closest("form")!); });
    await act(async () => {});
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Where you stand today");
    expect(calls).toContain("GET /api/state");
  });
});

describe("signed in", () => {
  it("loads progress from the server and hides Admin from members", async () => {
    fakeServer({
      "/api/me": () => [200, member],
      "/api/state": () => [200, { ...EMPTY_STATE, items: { ts1: "done" } }],
    });
    await renderAt("/ts");
    expect(screen.getByText("1/12 learned")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Admin/ })).toBeNull();
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByRole("menu").textContent).toContain("friend@example.com");
  });

  it("sends writes with the CSRF header", async () => {
    let header: string | null = null;
    fakeServer({ "/api/me": () => [200, member], "/api/state": () => [200, EMPTY_STATE] });
    const inner = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") header = new Headers(init.headers).get("X-Prep-Client");
      return inner(url, init);
    }) as typeof fetch;
    await renderAt("/ts?open=ts1");
    fireEvent.click(screen.getAllByLabelText("Mark done")[0]);
    await act(async () => {});
    expect(header).toBe("1");
  });

  it("drops back to the landing page when the session expires", async () => {
    fakeServer({
      "/api/me": () => [200, member],
      "/api/state": () => [401, { error: "sign in required" }],
      "/api/auth/config": () => [200, { providers: ["google"], devLogin: false }],
    });
    await renderAt("/");
    expect(screen.getByText("Sign in", { selector: "h2" })).toBeTruthy();
  });

  it("admins see the Admin page with invites and users", async () => {
    fakeServer({
      "/api/me": () => [200, admin],
      "/api/state": () => [200, EMPTY_STATE],
      "/api/admin/invites": () => [200, [{ email: "new@example.com", created_at: 1790000000, used_at: null, invited_by: admin.email }]],
      "/api/admin/users": () => [200, [{ ...admin, created_at: 1790000000, last_login: 1790000000, disabled: false, done: 3 }]],
    });
    await renderAt("/admin");
    await act(async () => {});
    expect(screen.getAllByRole("link", { name: /Admin/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("new@example.com")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
  });
});
