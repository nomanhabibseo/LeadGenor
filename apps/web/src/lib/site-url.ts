export function normalizeSiteUrlInput(raw: string) {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Compare two site URLs for equality (scheme/www/trailing slash tolerant). */
export function siteUrlsEqual(a: string, b: string): boolean {
  const norm = (s: string) => {
    const t = normalizeSiteUrlInput(s.trim());
    if (!t) return "";
    try {
      const u = new URL(t);
      const host = u.hostname.replace(/^www\./i, "");
      const path = u.pathname.replace(/\/$/, "") || "";
      return `${host}${path}`.toLowerCase();
    } catch {
      return t.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
    }
  };
  return norm(a) === norm(b);
}
