import { apiUrl, browserUsesDevProxy } from "@/lib/api";

/** Client fetch must outlast the Next dev proxy and Nest (sheet download + row processing). */
const IMPORT_TIMEOUT_MS = 600_000;

function extractNestMessage(j: Record<string, unknown>): string {
  const m = j.message;
  if (Array.isArray(m)) return m.map(String).filter(Boolean).join("; ");
  if (typeof m === "string" && m.trim()) return m.trim();
  if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  return "";
}

function isGenericServerError(msg: string, raw: string): boolean {
  const t = msg.trim().toLowerCase();
  if (t && t !== "internal server error") return false;
  if (!t && !raw.trim()) return true;
  return t === "internal server error" || /^internal server error$/i.test(raw.trim());
}

function devProxyHint(): string {
  if (!browserUsesDevProxy()) return "";
  return "\n\nIf the import was large, the Next.js dev proxy may have closed the connection even though Nest finished the job—refresh the vendors or list page. To call the API directly in dev, set NEXT_PUBLIC_DEV_USE_DIRECT_API=1 in apps/web/.env.local (use when your machine can reach the API URL in the browser).";
}

export type ImportExportSuccessBody = {
  imported?: number;
  added?: number;
  message?: string | string[];
  errors?: string[];
  warnings?: string[];
  /** Vendors/clients import: skipped as duplicates. Lists import: URLs already on this list before import. */
  skippedExistingCount?: number;
  skippedExistingUrls?: string[];
  [key: string]: unknown;
};

export type PostImportExportResult =
  | { ok: true; data: ImportExportSuccessBody }
  | { ok: false; message: string; cancelled?: boolean };

/**
 * POST to import-export or long-running import endpoints with a long timeout and readable errors
 * (Nest JSON or plain text / proxy HTML).
 * Pass `signal` to allow the user to cancel; user abort yields `{ ok: false, cancelled: true }`.
 */
export async function postImportExport(
  path: string,
  token: string | undefined,
  body: unknown,
  opts?: { signal?: AbortSignal },
): Promise<PostImportExportResult> {
  if (!token) return { ok: false, message: "Not signed in." };

  const external = opts?.signal;
  const fetchCtrl = new AbortController();
  const tid = window.setTimeout(() => fetchCtrl.abort(), IMPORT_TIMEOUT_MS);

  let forwardExternalAbort: (() => void) | undefined;
  if (external) {
    forwardExternalAbort = () => fetchCtrl.abort();
    if (external.aborted) {
      window.clearTimeout(tid);
      return { ok: false, cancelled: true, message: "" };
    }
    external.addEventListener("abort", forwardExternalAbort, { once: true });
  }

  try {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: fetchCtrl.signal,
    });
    const raw = await res.text();
    let j: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        j = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        let m =
          raw.slice(0, 900).trim() ||
          `HTTP ${res.status} ${res.statusText} (response was not JSON).`;
        if ([502, 503, 504].includes(res.status)) {
          m = `Gateway timeout or bad gateway (${res.status}). The import may still be running on the server—check your list or vendors after a minute.${
            devProxyHint() || "\n\nIf you use Next.js dev rewrites, try increasing experimental.proxyTimeout in next.config or use NEXT_PUBLIC_DEV_USE_DIRECT_API=1."
          }`;
        }
        return { ok: false, message: m };
      }
    }
    const msg = extractNestMessage(j);
    if (!res.ok) {
      let out = msg || "";
      if (!out.trim()) {
        if ([502, 503, 504].includes(res.status)) {
          out = `Gateway error (${res.status}). Long imports can hit the proxy limit—the API may still complete; refresh the target page to verify.${devProxyHint()}`;
        } else if (res.status === 500 && isGenericServerError(msg, raw)) {
          out = `Request failed (${res.status}). The server may have hit an error, or the dev proxy closed the connection while the import was still running. Refresh vendors / list counts to see if rows were added.${devProxyHint()}`;
        } else {
          out = `HTTP ${res.status} ${res.statusText}`.trim();
        }
      } else if (res.status === 500 && isGenericServerError(msg, raw)) {
        out = `${msg}${devProxyHint()}`;
      }
      return { ok: false, message: out };
    }
    return { ok: true, data: j as ImportExportSuccessBody };
  } catch (e: unknown) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "AbortError") {
      if (external?.aborted === true) {
        return { ok: false, cancelled: true, message: "" };
      }
      return {
        ok: false,
        message: `Import timed out after ${Math.round(IMPORT_TIMEOUT_MS / 60_000)} minutes. Try CSV upload, a smaller sheet, or split the file.${devProxyHint()}`,
      };
    }
    return { ok: false, message: e instanceof Error ? e.message : "Import failed." };
  } finally {
    window.clearTimeout(tid);
    if (external && forwardExternalAbort) {
      external.removeEventListener("abort", forwardExternalAbort);
    }
  }
}

export function formatImportExportResultLines(data: ImportExportSuccessBody): string {
  const lines: string[] = [];
  if (typeof data.imported === "number") lines.push(`Imported ${data.imported} row(s).`);
  if (typeof data.added === "number") lines.push(`Saved ${data.added} list row(s) (new or updated).`);
  const skipN = data.skippedExistingCount;
  const warnedSkip =
    data.warnings?.some((w) =>
      String(w).includes("already exist in your Vendors"),
    ) ?? false;
  if (typeof skipN === "number" && skipN > 0 && !warnedSkip) {
    lines.push(`${skipN} URL(s) were already in your data and were not added.`);
  }
  const msg = data.message;
  if (msg) {
    if (Array.isArray(msg)) lines.push(...msg.map(String));
    else lines.push(String(msg));
  }
  if (data.errors?.length) lines.push(...data.errors.slice(0, 24).map(String));
  if (data.warnings?.length) lines.push(...data.warnings.map(String));
  return lines.filter(Boolean).join("\n\n") || "Import finished.";
}

/** Skipped / overlapping URLs from the API (meaning depends on endpoint). */
export function extractSkippedExistingUrls(data: ImportExportSuccessBody): string[] {
  const raw = data.skippedExistingUrls;
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}
