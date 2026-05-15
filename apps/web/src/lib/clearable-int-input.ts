/** Lets users clear a numeric field (e.g. backspace default 0) before typing a new value. */

export function clearableIntValue(n: number, opts?: { showZero?: boolean }): string {
  if (opts?.showZero) return String(n);
  return n === 0 ? "" : String(n);
}

export function parseClearableInt(
  raw: string,
  opts?: { min?: number; max?: number; emptyAs?: number },
): number {
  const t = raw.trim();
  if (t === "") return opts?.emptyAs ?? 0;
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return opts?.emptyAs ?? 0;
  let v = n;
  const min = opts?.min ?? 0;
  if (v < min) v = min;
  if (opts?.max != null && v > opts.max) v = opts.max;
  return v;
}

/** Decimal amounts (costs, prices); empty field while typing maps to 0 unless `showZero`. */
export function clearableDecimalValue(n: number, opts?: { showZero?: boolean }): string {
  if (n === 0 || Object.is(n, -0)) return opts?.showZero ? "0" : "";
  return String(n);
}

export function parseClearableDecimal(
  raw: string,
  opts?: { min?: number; max?: number; emptyAs?: number },
): number {
  const t = raw.trim();
  if (t === "") return opts?.emptyAs ?? 0;
  const n = parseFloat(t.replace(/,/g, ""));
  if (Number.isNaN(n)) return opts?.emptyAs ?? 0;
  let v = n;
  const min = opts?.min ?? 0;
  if (v < min) v = min;
  if (opts?.max != null && v > opts.max) v = opts.max;
  return v;
}
