/** First word of a niche label for compact tables (e.g. "Food & recipe" → "Food"). */
export function nicheFirstWord(label: string | undefined): string {
  if (!label?.trim()) return "—";
  const w = label.trim().split(/[\s&|,]+/)[0];
  if (!w) return "—";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Short country display: USA, UK, PK from ISO2 codes. */
export function countryShortLabel(code: string | undefined): string {
  if (!code?.trim()) return "—";
  const up = code.trim().toUpperCase();
  if (up === "US") return "USA";
  if (up === "GB") return "UK";
  return up;
}

/** One short code for exports / CSV: first country only (no duplicate TLDs). */
export function countriesShortList(
  countries: { country: { code?: string; name?: string } }[] | undefined,
): string {
  if (!countries?.length) return "—";
  return countryShortLabel(countries[0]!.country.code);
}
