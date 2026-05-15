import { parse as parseHostname } from 'tldts';

/**
 * Brand-style site label from URL: registrable hostname without public suffix (`forbes.com` → `forbes`),
 * aligned with `website_name` merge field (e.g. `blogs.forbes.com` → `forbes`).
 */
export function websiteNameFromSiteUrl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  let hostname = '';
  try {
    const withProto = /^[a-z][a-z\d+\-.]*:\/\//i.test(t) ? t : `https://${t}`;
    hostname = new URL(withProto).hostname;
  } catch {
    const stripped = t.replace(/^[a-z][a-z\d+\-.]*:\/\//i, '');
    hostname =
      stripped
        .split(/[/?#]/)[0]
        ?.split('@')
        .pop()
        ?.split(':')[0]
        ?.trim()
        .toLowerCase() ?? '';
  }
  hostname = hostname.trim().toLowerCase();
  if (!hostname) return '';

  const { domainWithoutSuffix } = parseHostname(hostname);
  const brand = (domainWithoutSuffix ?? '').trim().toLowerCase();
  if (brand) return brand;

  let h = hostname;
  while (h.startsWith('www.')) h = h.slice(4);
  const segments = h.split('.').filter(Boolean);
  if (segments.length <= 1) return segments[0] ?? '';
  if (segments.length === 2) return segments[0] ?? '';
  return segments[segments.length - 2] ?? segments[0] ?? '';
}
