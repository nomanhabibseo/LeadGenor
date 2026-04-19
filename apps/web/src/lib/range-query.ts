/**
 * Parse a single filter field like "10 - 50", "10-50", "100" into min/max for API query params.
 */
export function parseRangeField(input: string | undefined | null): {
  min?: number;
  max?: number;
} {
  const t = String(input ?? "").trim();
  if (!t) return {};
  const split = t.split(/\s*[-–—]\s*|\s+to\s+/i).map((x) => x.trim()).filter(Boolean);
  if (split.length >= 2) {
    const a = Number(split[0]);
    const b = Number(split[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const n = Number(t);
  if (!Number.isNaN(n)) return { min: n, max: n };
  return {};
}

export function appendRangeParams(
  qs: URLSearchParams,
  baseKey: string,
  rangeStr: string,
) {
  const { min, max } = parseRangeField(rangeStr);
  if (min != null) qs.set(`${baseKey}Min`, String(min));
  if (max != null) qs.set(`${baseKey}Max`, String(max));
}
