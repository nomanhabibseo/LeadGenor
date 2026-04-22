import type { EmailListItem } from '@prisma/client';

/** Merge fields available in templates and campaign emails. */
export const MERGE_FIELD_KEYS = [
  'company_name',
  'client_name',
  'vendor_name',
  'niche',
  'country',
  'traffic',
  'dr',
  'da',
  'authority_score',
  'backlinks',
  'referring_domains',
  'site_url',
  'emails',
] as const;

export type MergeFieldKey = (typeof MERGE_FIELD_KEYS)[number];

export function buildMergeVars(item: EmailListItem): Record<string, string> {
  const emails = (item.emails as unknown as string[]) ?? [];
  const vendorOrClient =
    item.contactKind === 'VENDOR' ? item.contactName : item.contactKind === 'CLIENT' ? item.contactName : '';
  return {
    company_name: item.companyName ?? '',
    client_name: item.contactKind === 'CLIENT' ? item.contactName : '',
    vendor_name: item.contactKind === 'VENDOR' ? item.contactName : '',
    niche: item.niche ?? '',
    country: item.country ?? '',
    traffic: String(item.traffic ?? 0),
    dr: String(item.dr ?? 0),
    da: String(item.da ?? 0),
    authority_score: String(item.authorityScore ?? 0),
    backlinks: String(item.backlinks ?? 0),
    referring_domains: String(item.referringDomains ?? 0),
    site_url: item.siteUrl ?? '',
    emails: emails.join(', '),
    contact_name: vendorOrClient,
  };
}

export function applyMergeTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
    out = out.replace(re, v);
  }
  return out;
}

export function missingMergeVars(template: string, vars: Record<string, string>): string[] {
  const re = /\{\{\s*([\w_]+)\s*\}\}/g;
  const missing: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const key = m[1];
    if (!(key in vars) || String(vars[key] ?? '').trim() === '') {
      if (!missing.includes(key)) missing.push(key);
    }
  }
  return missing;
}
