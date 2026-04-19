/** Split user input into unique valid emails; preserves first-seen casing. */
export function parseEmails(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  const normalized = raw.replace(/\r\n/g, '\n');
  const parts = normalized.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
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

export function joinEmails(emails: string[]): string {
  return emails.join(', ');
}
