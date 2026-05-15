/** Client-side: extract valid emails from comma / newline / semicolon separated input. */
export function parseEmailsClient(raw: string): string[] {
  if (!raw?.trim()) return [];
  const parts = raw.replace(/\r\n/g, "\n").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const p of parts) {
    if (!re.test(p)) continue;
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}
