/** Must match rewrite `LG_DEV_API_PROXY` in apps/web/next.config.ts */
const NEXT_DEV_API_PROXY_SEGMENT = "/lg-api-proxy";

function serverAbsoluteBase(): string {
  const fromPublic = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (fromPublic) return fromPublic;
  const fromApi = process.env.API_URL?.trim().replace(/\/$/, "");
  if (fromApi) return fromApi;
  return "http://127.0.0.1:4000";
}

/**
 * In development, browser calls must go through Next rewrites (`/lg-api-proxy/…`) so they work when you open
 * the app as http://LAN_IP:3000 — direct `NEXT_PUBLIC_API_URL=http://localhost:4000` would hit the wrong host.
 * Set `NEXT_PUBLIC_DEV_USE_DIRECT_API=1` only if you intentionally want the browser to call the absolute API URL.
 */
/** Exported for import helpers that need to hint when the Next.js dev proxy may time out before Nest responds. */
export function browserUsesDevProxy(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  const forceDirect =
    /^1|true$/i.test((process.env.NEXT_PUBLIC_DEV_USE_DIRECT_API ?? "").trim());
  return !forceDirect;
}

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (browserUsesDevProxy()) {
    return `${NEXT_DEV_API_PROXY_SEGMENT}${p}`;
  }
  const base = serverAbsoluteBase().replace(/\/$/, "");
  return `${base}${p}`;
}

/** Avoid hung UI when Nest is starting, DB pool is stuck, or the dev proxy resets the socket. */
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;

function mergedTimeoutSignal(existing: AbortSignal | undefined): AbortSignal {
  const timeoutSig = AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS);
  if (!existing) return timeoutSig;
  if (existing.aborted) return existing;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([existing, timeoutSig]);
  }
  const ctrl = new AbortController();
  const forward = (reason: unknown) => {
    if (ctrl.signal.aborted) return;
    try {
      ctrl.abort(reason as never);
    } catch {
      ctrl.abort();
    }
  };
  existing.addEventListener("abort", () => forward(existing.reason), { once: true });
  timeoutSig.addEventListener(
    "abort",
    () => forward(new DOMException("The operation timed out.", "TimeoutError")),
    { once: true },
  );
  return ctrl.signal;
}

export async function apiFetch<T>(
  path: string,
  token: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const signal = mergedTimeoutSignal(init?.signal === null ? undefined : init?.signal);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers, signal });
  } catch (e) {
    const name =
      typeof e === "object" &&
      e !== null &&
      "name" in e &&
      typeof (e as { name?: string }).name === "string"
        ? (e as { name: string }).name
        : "";
    const msg =
      name === "TimeoutError"
        ? `Request timed out after ${Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000)}s (${path}). The API may be busy or restarting.`
        : `Network error (${path}). Is Nest running (${browserUsesDevProxy() ? `web dev proxy → ${serverAbsoluteBase()}` : serverAbsoluteBase()}) and reachable?`;
    throw new Error(msg);
  }
  if (!res.ok) {
    const raw = await res.text();
    let body: { message?: string | string[]; error?: string } | null = null;
    try {
      body = JSON.parse(raw) as { message?: string | string[]; error?: string };
    } catch {
      /* not JSON */
    }
    let msg = "";
    if (body?.message != null) {
      msg = Array.isArray(body.message) ? body.message.join(", ") : String(body.message);
    }
    if (!msg.trim() && body?.error) {
      msg = String(body.error);
    }
    const trimmed = raw.trim();
    if (!msg.trim() && trimmed && trimmed !== "Internal Server Error") {
      msg = trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed;
    }
    if (!msg.trim()) {
      msg =
        res.status === 500
          ? "Server error (500). Check the terminal where the API runs for the stack trace, and ensure database migrations are applied (packages/db: npx prisma migrate deploy)."
          : res.statusText || `Request failed (${res.status})`;
    } else if (/^internal server error$/i.test(msg.trim()) && res.status === 500) {
      msg += " Check the API process logs, or run DB migrations from packages/db (npx prisma migrate deploy).";
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetchBlob(
  path: string,
  token: string | undefined,
  body?: object,
): Promise<Blob> {
  const headers = new Headers();
  if (body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const signal = mergedTimeoutSignal(undefined);
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.blob();
}
