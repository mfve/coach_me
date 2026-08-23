// Chat/plan-generation calls can chain two Agent SDK calls back to back (reply + a resolved
// "regenerate" proposal), which can run long — but with no timeout at all, a genuine hang looks
// identical to "got no response" with nothing to show the user. 120s covers that chained case
// with room to spare while still eventually surfacing a clear error instead of hanging forever.
const REQUEST_TIMEOUT_MS = 120_000;

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, headers, signal: init.signal ?? controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out — the coach took too long to respond. Try again?");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiFetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof body === "object" && body && "error" in body ? (body as any).error : String(body);
    throw new Error(message || `Request failed (${res.status})`);
  }

  return body as T;
}
