/** PostgreSQL / Prisma signed 32-bit Int max — clamp oversized sheet values instead of failing the row. */
const PG_INT_MAX = 2_147_483_647;

/**
 * Parses quantity cells commonly found in spreadsheets: `30K`, `38.8K`, `900K`, `9M`, `1.5B`,
 * comma-formatted integers (`300,000`), and plain integers. Used for traffic, backlinks, referring domains on import.
 *
 * Rules (case-insensitive suffix after optional spaces):
 * - K → × 1 000 (e.g. 90.9K → 90900)
 * - M → × 1 000 000
 * - B → × 1 000 000 000 (clamped to DB Int max)
 */
/** Cyrillic letters often pasted from spreadsheets where the font looks Latin. */
function normalizeMetricSuffixLetters(s: string): string {
  return s.replace(/\u041a/g, 'K').replace(/\u043a/g, 'k').replace(/\u041c/g, 'M').replace(/\u043c/g, 'm').replace(/\u0412/g, 'B').replace(/\u0432/g, 'b');
}

export function parseAbbreviatedMetricInt(raw: unknown): number {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (!s || s === '—' || s === '–' || s === '-') return 0;

  s = normalizeMetricSuffixLetters(s.normalize('NFKC'));

  // Strip spaces, narrow no-break spaces, commas (thousands), and BOM-like chars.
  s = s.replace(/[\s\u00a0\u2000-\u200b\u202f\ufeff]+/g, '').replace(/,/g, '');
  if (!s) return 0;

  const m = /^([+-]?[\d.]+)([kmb])?$/i.exec(s);
  if (m) {
    const base = Number.parseFloat(m[1]);
    if (!Number.isFinite(base)) return 0;
    const suf = (m[2] ?? '').toLowerCase();
    let mult = 1;
    if (suf === 'k') mult = 1_000;
    else if (suf === 'm') mult = 1_000_000;
    else if (suf === 'b') mult = 1_000_000_000;
    const v = Math.round(Math.abs(base) * mult);
    return Math.min(v, PG_INT_MAX);
  }

  const cleaned = s.replace(/[^0-9.+-]/g, '');
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(Math.abs(n));
  return Math.min(v, PG_INT_MAX);
}
