import { apiUrl, browserUsesDevProxy } from "@/lib/api";
import type { ImportExportSuccessBody, PostImportExportResult } from "@/lib/post-import-export";

const IMPORT_TIMEOUT_MS = 600_000;

function devProxyHint(): string {
  if (!browserUsesDevProxy()) return "";
  return "\n\nIf the import was large, the Next.js dev proxy may have closed the connection—use NEXT_PUBLIC_DEV_USE_DIRECT_API=1 in apps/web/.env.local when your browser can reach the API URL directly.";
}

function extractNestMessage(j: Record<string, unknown>): string {
  const m = j.message;
  if (Array.isArray(m)) return m.map(String).filter(Boolean).join("; ");
  if (typeof m === "string" && m.trim()) return m.trim();
  if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  return "";
}

type ProgressHandler = (p: { imported: number; total?: number }) => void;

/**
 * Import endpoints that stream NDJSON: `{"type":"progress",...}\n` then final `{"type":"done",...}\n`.
 */
export async function postImportNdjsonStream(
  path: string,
  token: string | undefined,
  body: unknown,
  opts: { signal?: AbortSignal; onProgress?: ProgressHandler },
): Promise<PostImportExportResult> {
  if (!token) return { ok: false, message: "Not signed in." };

  const external = opts.signal;
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
        Accept: "application/x-ndjson, application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: fetchCtrl.signal,
    });

    if (!res.ok) {
      const raw = await res.text();
      let msg = raw.slice(0, 900).trim() || `HTTP ${res.status}`;
      try {
        const j = JSON.parse(raw) as Record<string, unknown>;
        const m = extractNestMessage(j);
        if (m) msg = m;
      } catch {
        /* plain text */
      }
      if ([502, 503, 504].includes(res.status)) {
        msg = `Gateway timeout or bad gateway (${res.status}).${devProxyHint()}`;
      }
      return { ok: false, message: msg };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { ok: false, message: "No response body from import stream." };
    }

    const dec = new TextDecoder();
    let buf = "";
    let lastDone: ImportExportSuccessBody | null = null;
    let streamError: string | null = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let row: Record<string, unknown>;
        try {
          row = JSON.parse(t) as Record<string, unknown>;
        } catch {
          streamError = "Invalid import stream line.";
          continue;
        }
        const typ = row.type;
        if (typ === "progress") {
          const imported = Number(row.imported);
          const total = row.total != null ? Number(row.total) : undefined;
          if (Number.isFinite(imported)) {
            opts.onProgress?.({ imported, total: Number.isFinite(total as number) ? total : undefined });
          }
        } else if (typ === "done") {
          lastDone = row as unknown as ImportExportSuccessBody;
        } else if (typ === "error") {
          streamError = typeof row.message === "string" ? row.message : "Import failed.";
        }
      }
    }

    const tail = buf.trim();
    if (tail) {
      try {
        const row = JSON.parse(tail) as Record<string, unknown>;
        if (row.type === "done") lastDone = row as unknown as ImportExportSuccessBody;
        if (row.type === "error") streamError = typeof row.message === "string" ? row.message : "Import failed.";
      } catch {
        /* incomplete */
      }
    }

    if (streamError) return { ok: false, message: streamError };

    if (lastDone) {
      return { ok: true, data: lastDone };
    }

    if (external?.aborted === true) {
      return { ok: false, cancelled: true, message: "" };
    }

    return { ok: false, message: `Import stream ended unexpectedly.${devProxyHint()}` };
  } catch (e: unknown) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "AbortError") {
      if (external?.aborted === true) {
        return { ok: false, cancelled: true, message: "" };
      }
      return {
        ok: false,
        message: `Import timed out after ${Math.round(IMPORT_TIMEOUT_MS / 60_000)} minutes.${devProxyHint()}`,
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
