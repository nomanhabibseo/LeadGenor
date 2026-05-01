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
function browserUsesDevProxy(): boolean {
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
  const res = await fetch(apiUrl(path), { ...init, headers });
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
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.blob();
}
