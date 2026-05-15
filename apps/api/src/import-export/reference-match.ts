/**
 * Fuzzy resolution of CSV/sheet values against reference niches, countries, languages
 * so imports tolerate abbreviations (e.g. "tech" → Technology) and spelling variants ("Sri lanka").
 */

export type NicheRef = { id: string; label: string; slug: string };
export type CountryRef = { id: string; code: string; name: string };
export type LanguageRef = { id: string; code: string; name: string };

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  USA: 'US',
  UK: 'GB',
  UAE: 'AE',
  KSA: 'SA',
  US: 'US',
  GB: 'GB',
};

/** NFKD + strip marks for comparing "São Paulo" style strings */
export function normalizeMatchToken(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function bestScoreLevenshtein(input: string, target: string, minRatio: number): number {
  if (!input || !target) return 0;
  const maxLen = Math.max(input.length, target.length, 1);
  const d = levenshtein(input.slice(0, 80), target.slice(0, 80));
  const ratio = 1 - d / maxLen;
  return ratio >= minRatio ? Math.round(55 + 40 * ratio) : 0;
}

/**
 * Match a single user-provided niche fragment to one reference niche.
 * Threshold ~62: allows "tech" → Technology via prefix / substring rules.
 */
export function matchBestNiche(raw: string, niches: NicheRef[]): NicheRef | null {
  const input = normalizeMatchToken(raw);
  if (!input) return null;

  let best: { n: NicheRef; score: number } | null = null;
  for (const n of niches) {
    const label = normalizeMatchToken(n.label);
    const slugAsWords = n.slug.toLowerCase().replace(/-/g, ' ').trim();
    const slugCompact = slugAsWords.replace(/\s/g, '');

    let score = 0;
    if (input === label) score = 100;
    else if (input === slugCompact) score = 98;
    else if (label.startsWith(input) && input.length >= 2) score = 92;
    else if (label.includes(input) && input.length >= 3) score = 82;
    else if (input.includes(label) && label.length >= 4) score = 78;
    else if (slugAsWords.includes(input) || slugCompact.includes(input.replace(/\s/g, ''))) score = 75;
    else {
      const lev = bestScoreLevenshtein(input, label, 0.72);
      if (lev > score) score = lev;
    }

    if (score > (best?.score ?? 0)) best = { n, score };
  }

  return best && best.score >= 62 ? best.n : null;
}

/**
 * Match country by ISO code, common aliases, or fuzzy name ("Sri lanka", "United States").
 */
export function matchBestCountry(raw: string, countries: CountryRef[]): CountryRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const up = trimmed.toUpperCase().replace(/[^A-Z]/g, '');
  const codeFromAlias = COUNTRY_CODE_ALIASES[trimmed.toUpperCase()] ?? trimmed.toUpperCase();
  if (codeFromAlias.length === 2 || up.length === 2) {
    const code2 = (codeFromAlias.length >= 2 ? codeFromAlias : up).slice(0, 2);
    const byCode = countries.find((c) => c.code.toUpperCase() === code2);
    if (byCode) return byCode;
  }

  const input = normalizeMatchToken(trimmed);
  if (!input) return null;

  let best: { c: CountryRef; score: number } | null = null;
  for (const c of countries) {
    const name = normalizeMatchToken(c.name);
    let score = 0;
    if (input === name) score = 100;
    else if (name.includes(input) || input.includes(name)) score = input.length >= 3 || name.length <= 5 ? 88 : 80;
    else {
      const lev = bestScoreLevenshtein(input, name, 0.78);
      if (lev > score) score = lev;
    }
    if (score > (best?.score ?? 0)) best = { c, score };
  }

  return best && best.score >= 68 ? best.c : null;
}

export function matchBestLanguage(raw: string, languages: LanguageRef[]): LanguageRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const codeGuess = trimmed.toLowerCase().slice(0, 8);
  const byCode = languages.find((l) => l.code.toLowerCase() === codeGuess);
  if (byCode) return byCode;

  const input = normalizeMatchToken(trimmed);
  if (!input) return null;

  let best: { l: LanguageRef; score: number } | null = null;
  for (const lang of languages) {
    const name = normalizeMatchToken(lang.name);
    let score = 0;
    if (input === name) score = 100;
    else if (name.startsWith(input) && input.length >= 2) score = 90;
    else if (name.includes(input) && input.length >= 3) score = 82;
    else {
      const lev = bestScoreLevenshtein(input, name, 0.75);
      if (lev > score) score = lev;
    }
    if (score > (best?.score ?? 0)) best = { l: lang, score };
  }

  return best && best.score >= 65 ? best.l : null;
}

/** Split "A, B | C" niche lists and return distinct matched niche ids */
export function resolveNicheIdsFromRaw(nicheRaw: string, niches: NicheRef[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of nicheRaw.split(/[,;|]/)) {
    const label = part.trim();
    if (!label) continue;
    const n = matchBestNiche(label, niches);
    if (n && !seen.has(n.id)) {
      seen.add(n.id);
      ids.push(n.id);
    }
  }
  return ids;
}

export function resolveCountryIdsFromRaw(countryRaw: string, countries: CountryRef[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of countryRaw.split(/[,;|]/)) {
    const p = part.trim();
    if (!p) continue;
    const c = matchBestCountry(p, countries);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      ids.push(c.id);
    }
  }
  return ids;
}
