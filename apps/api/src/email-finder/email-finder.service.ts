import { Injectable } from '@nestjs/common';

type FindEmailsResult =
  | { ok: true; emails: string[] }
  | { ok: false; reason: 'not_found' | 'bad_url' | 'fetch_failed' };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_RE = /href\s*=\s*(?:"mailto:([^"]+)"|'mailto:([^']+)')/gi;

function uniqLower(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.trim();
    if (!e) continue;
    const k = e.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function normalizeUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t);
    return new URL(`https://${t}`);
  } catch {
    return null;
  }
}

function absoluteSameHost(base: URL, href: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.host !== base.host) return null;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function extractEmails(html: string): string[] {
  const found = html.match(EMAIL_RE) ?? [];
  // Strip common trailing punctuation from text nodes.
  const cleaned = found.map((x) => x.replace(/[)\].,;:!?]+$/g, ''));
  return uniqLower(cleaned);
}

function extractMailtoEmails(html: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MAILTO_RE.exec(html))) {
    const raw = (m[1] ?? m[2] ?? '').trim();
    if (!raw) continue;
    const cleaned = raw.split(/[?&#]/)[0]?.trim() ?? '';
    if (cleaned) out.push(cleaned);
  }
  return uniqLower(out);
}

function extractCandidateLinks(base: URL, html: string): string[] {
  const out: string[] = [];
  const hrefRe = /href\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html))) {
    const href = (m[1] ?? m[2] ?? '').trim();
    if (!href) continue;
    const lower = href.toLowerCase();
    if (
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:') ||
      lower.startsWith('javascript:')
    ) {
      continue;
    }
    const abs = absoluteSameHost(base, href);
    if (!abs) continue;
    // Prioritize likely pages.
    if (/(contact|about|support|help|impressum|team)/i.test(abs)) out.push(abs);
  }
  return uniqLower(out).slice(0, 12);
}

async function fetchHtml(url: string, timeoutMs = 6_000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        // Keep it simple and polite.
        'User-Agent': 'LeadGenorEmailFinder/1.0 (+https://leadgenor.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml')) return null;
    const text = await res.text();
    // Safety limit to avoid huge pages.
    return text.length > 1_200_000 ? text.slice(0, 1_200_000) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

@Injectable()
export class EmailFinderService {
  /**
   * Crawl strategy (same website only):
   * - Homepage
   * - links that look like contact/about/support (from homepage)
   * - common paths (/contact, /contact-us, /about, /about-us)
   */
  async findEmailsFromSiteUrl(rawUrl: string): Promise<FindEmailsResult> {
    const base = normalizeUrl(rawUrl);
    if (!base) return { ok: false, reason: 'bad_url' };

    // If the site blocks https, try http fallback later.
    const startUrls = [base.toString()];
    const common = [
      '/contact',
      '/contact-us',
      '/contacts',
      '/support',
      '/about',
      '/about-us',
      '/team',
      '/.well-known/security.txt',
    ].map((p) => new URL(p, base).toString());
    const visited = new Set<string>();

    const tryUrl = async (u: string, timeoutMs?: number) => {
      if (visited.has(u)) return { html: null as string | null, emails: [] as string[], links: [] as string[] };
      visited.add(u);
      const html = await fetchHtml(u, timeoutMs);
      if (!html) return { html: null, emails: [], links: [] };
      const emails = uniqLower([...extractMailtoEmails(html), ...extractEmails(html)]);
      const links = extractCandidateLinks(base, html);
      return { html, emails, links };
    };

    // 1) homepage
    const first = await tryUrl(startUrls[0], 5_000);
    if (first.emails.length) return { ok: true, emails: first.emails };

    // 2) Fetch likely pages in parallel (fast) and return on first hit.
    const candidates = uniqLower([...first.links, ...common]).slice(0, 10);
    const probes = candidates.map(async (u) => {
      const r = await tryUrl(u, 5_500);
      return r.emails.length ? r.emails : null;
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Promise.any type noise
      const emails = await (Promise as any).any(probes);
      if (Array.isArray(emails) && emails.length) return { ok: true, emails };
    } catch {
      // none found
    }

    // 3) http fallback if https start failed quickly (common with some sites)
    if (base.protocol === 'https:') {
      try {
        const httpBase = new URL(base.toString());
        httpBase.protocol = 'http:';
        const r = await tryUrl(httpBase.toString(), 4_000);
        if (r.emails.length) return { ok: true, emails: r.emails };
      } catch {
        // ignore
      }
    }

    // Nothing found.
    // If we couldn't fetch anything at all, call it fetch_failed; otherwise not_found.
    const anyFetched = visited.size > 0;
    return anyFetched ? { ok: false, reason: 'not_found' } : { ok: false, reason: 'fetch_failed' };
  }
}

