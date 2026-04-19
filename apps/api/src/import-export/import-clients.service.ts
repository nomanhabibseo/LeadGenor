import { Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { ClientsService } from '../clients/clients.service';
import type { ClientBodyDto } from '../clients/dto/client-body.dto';
import { PrismaService } from '../prisma/prisma.service';

function normHeader(k: string) {
  return k
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

@Injectable()
export class ImportClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  async importFromCsvText(userId: string, csv: string) {
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const rawRows = parsed.data.filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim()));

    const [niches, countries, languages] = await Promise.all([
      this.prisma.niche.findMany(),
      this.prisma.country.findMany(),
      this.prisma.language.findMany(),
    ]);

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const cell = (...aliases: string[]) => {
        for (const [key, val] of Object.entries(row)) {
          const nk = normHeader(key);
          if (aliases.includes(nk) && String(val ?? '').trim()) return String(val).trim();
        }
        return '';
      };

      const siteRaw = cell('site_url', 'url', 'website', 'site');
      const email = cell('email', 'contact_email');
      if (!siteRaw || !email) {
        errors.push(`Row ${i + 2}: missing site URL or email.`);
        continue;
      }

      const siteUrl = siteRaw.startsWith('http') ? siteRaw : `https://${siteRaw}`;
      let companyName = cell('company_name', 'company');
      let clientName = cell('client_name', 'client', 'name');
      if (!companyName) {
        try {
          companyName = new URL(siteUrl).hostname.replace(/^www\./, '');
        } catch {
          companyName = 'Imported';
        }
      }
      if (!clientName) clientName = companyName;

      const nicheRaw = cell('niche', 'niches', 'category');
      const nicheIds: string[] = [];
      if (nicheRaw) {
        for (const part of nicheRaw.split(/[,;|]/)) {
          const label = part.trim();
          if (!label) continue;
          const n = niches.find(
            (x) =>
              x.label.toLowerCase() === label.toLowerCase() ||
              x.slug.toLowerCase() === label.toLowerCase().replace(/\s+/g, '-'),
          );
          if (n) nicheIds.push(n.id);
        }
      }
      if (nicheIds.length === 0) {
        errors.push(`Row ${i + 2}: no matching niche for "${nicheRaw || '(empty)'}".`);
        continue;
      }

      const countryRaw = cell('country', 'country_code');
      const countryIds: string[] = [];
      if (countryRaw) {
        const up = countryRaw.toUpperCase();
        const alias: Record<string, string> = { USA: 'US', UK: 'GB', UAE: 'AE' };
        const code2 = (alias[up] ?? up).slice(0, 2);
        const c =
          countries.find((x) => x.code.toUpperCase() === code2) ??
          countries.find((x) => x.name.toLowerCase() === countryRaw.toLowerCase());
        if (c) countryIds.push(c.id);
      }
      if (countryIds.length === 0) {
        errors.push(`Row ${i + 2}: unknown country "${countryRaw || '(empty)'}".`);
        continue;
      }

      const langRaw = cell('language', 'lang') || 'en';
      const lang =
        languages.find((l) => l.code.toLowerCase() === langRaw.toLowerCase()) ??
        languages.find((l) => l.name.toLowerCase() === langRaw.toLowerCase());
      if (!lang) {
        errors.push(`Row ${i + 2}: unknown language "${langRaw}".`);
        continue;
      }

      const dto: ClientBodyDto = {
        companyName,
        clientName,
        siteUrl,
        email,
        nicheIds: nicheIds.slice(0, 5),
        countryIds: countryIds.slice(0, 3),
        languageId: lang.id,
        traffic: Number.parseInt(cell('traffic', 'monthly_traffic') || '0', 10) || 0,
        dr: Number.parseInt(cell('dr', 'domain_rating') || '0', 10) || 0,
        mozDa: Number.parseInt(cell('moz_da', 'da') || '0', 10) || 0,
        authorityScore: Number.parseInt(cell('authority_score', 'as') || '0', 10) || 0,
        referringDomains: Number.parseInt(cell('referring_domains', 'ref_domains') || '0', 10) || 0,
        backlinks: Number.parseInt(cell('backlinks') || '0', 10) || 0,
        whatsapp: cell('whatsapp', 'phone') || undefined,
      };

      try {
        await this.clients.createAnyway(userId, dto);
        imported++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Row ${i + 2}: ${msg}`);
      }
    }

    return {
      imported,
      failed: rawRows.length - imported,
      errors: errors.slice(0, 30),
      message:
        imported > 0
          ? `Successfully imported ${imported} client(s).`
          : 'No clients were imported. Fix errors below and try again.',
    };
  }
}
