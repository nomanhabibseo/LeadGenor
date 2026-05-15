/** Regional-indicator pair → flag emoji (ISO 3166-1 alpha-2). */
export function iso2ToFlagEmoji(iso2: string | undefined | null): string {
  if (!iso2 || iso2.length < 2) return "";
  const up = iso2.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (up.charCodeAt(0) - 65), A + (up.charCodeAt(1) - 65));
}

function normalizedIso2(iso2: string | undefined | null): string | null {
  if (!iso2 || iso2.length < 2) return null;
  const up = iso2.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return null;
  return up;
}

/** Widescreen flag image (flagcdn) — works where emoji flags fail (Windows, etc.). */
export function countryFlagImageUrl(iso2: string | undefined | null): string | null {
  const n = normalizedIso2(iso2);
  if (!n) return null;
  return `https://flagcdn.com/w40/${n.toLowerCase()}.png`;
}
