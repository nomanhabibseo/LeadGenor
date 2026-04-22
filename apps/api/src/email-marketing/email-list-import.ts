import * as Papa from 'papaparse';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { ListContactKind, EmailRiskLevel } from '@prisma/client';

function normHeader(k: string) {
  return k
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

function cell(row: Record<string, string>, ...aliases: string[]): string {
  for (const [key, val] of Object.entries(row)) {
    const nk = normHeader(key);
    if (aliases.includes(nk) && String(val ?? '').trim()) return String(val).trim();
  }
  return '';
}

function parseIntSafe(s: string, def = 0) {
  const n = Number.parseInt(s || String(def), 10);
  return Number.isFinite(n) ? n : def;
}

function parseEmails(raw: string): string[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
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

export type ParsedListRow = {
  siteUrl: string;
  siteUrlNormalized: string;
  companyName: string;
  contactName: string;
  contactKind: ListContactKind;
  niche: string;
  country: string;
  traffic: number;
  dr: number;
  da: number;
  authorityScore: number;
  backlinks: number;
  referringDomains: number;
  emails: string[];
  emailRisk: EmailRiskLevel;
};

export function parseEmailListCsv(csv: string): { rows: ParsedListRow[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const rawRows = parsed.data.filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim()));
  const rows: ParsedListRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const siteRaw = cell(row, 'site_url', 'url', 'website', 'site');
    if (!siteRaw) {
      errors.push(`Row ${i + 2}: missing site URL.`);
      continue;
    }
    const siteUrl = siteRaw.includes('://') ? siteRaw : `https://${siteRaw}`;
    const siteUrlNormalized = normalizeSiteUrl(siteUrl);
    let companyName = cell(row, 'company_name', 'company');
    if (!companyName) {
      try {
        companyName = new URL(siteUrl).hostname.replace(/^www\./, '');
      } catch {
        companyName = 'Unknown';
      }
    }
    const kindRaw = cell(row, 'contact_kind', 'type').toLowerCase();
    let contactKind: ListContactKind = ListContactKind.IMPORT;
    if (kindRaw.includes('vendor')) contactKind = ListContactKind.VENDOR;
    else if (kindRaw.includes('client')) contactKind = ListContactKind.CLIENT;

    const contactName =
      cell(row, 'client_name', 'vendor_name', 'contact_name', 'name', 'client', 'vendor') || companyName;

    const emailRaw = cell(row, 'email', 'emails', 'contact_email');
    const emails = parseEmails(emailRaw);

    rows.push({
      siteUrl,
      siteUrlNormalized,
      companyName,
      contactName,
      contactKind,
      niche: cell(row, 'niche', 'category'),
      country: cell(row, 'country'),
      traffic: parseIntSafe(cell(row, 'traffic', 'monthly_traffic')),
      dr: parseIntSafe(cell(row, 'dr', 'domain_rating')),
      da: parseIntSafe(cell(row, 'da', 'moz_da')),
      authorityScore: parseIntSafe(cell(row, 'authority_score', 'as')),
      backlinks: parseIntSafe(cell(row, 'backlinks')),
      referringDomains: parseIntSafe(cell(row, 'referring_domains', 'ref_domains')),
      emails,
      emailRisk: EmailRiskLevel.UNKNOWN,
    });
  }

  return { rows, errors };
}
