/**
 * Internal path-only redirect after login. Blocks protocol-relative and absolute URLs.
 */
export function sanitizeAppCallbackUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  const p = decoded.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(p)) return null;
  return p;
}
