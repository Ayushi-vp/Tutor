/* Thin fetch wrapper for the Flask API. Every request carries X-Prep-Client, which
   the server requires on writes as its cross-site request forgery check. */

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function call<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Prep-Client": "1" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(url, {
    method, headers, credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `${method} ${url}: ${r.status}`;
    try { msg = (await r.json()).error || msg; } catch { /* not JSON */ }
    throw new ApiError(r.status, msg);
  }
  return r.json() as Promise<T>;
}
