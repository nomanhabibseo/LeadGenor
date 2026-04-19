import { BadRequestException, Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { DealStatus, PaymentTerms, TatUnit } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { VendorsService } from '../vendors/vendors.service';
import type { VendorBodyDto } from '../vendors/dto/vendor-body.dto';

function normHeader(k: string) {
  return k
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

@Injectable()
export class ImportVendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendors: VendorsService,
  ) {}

  async importFromCsvText(userId: string, csv: string) {
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const rawRows = parsed.data.filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim()));

    const [niches, countries, languages, firstPm, usd] = await Promise.all([
      this.prisma.niche.findMany(),
      this.prisma.country.findMany(),
      this.prisma.language.findMany(),
      this.prisma.paymentMethod.findFirst({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.currency.findFirst({ where: { code: 'USD' } }),
    ]);
    const currencyId = usd?.id ?? (await this.prisma.currency.findFirst({ orderBy: { sortOrder: 'asc' } }))?.id;
    if (!currencyId) throw new BadRequestException('No currency in database. Run seed.');

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
      const email = cell('contact_email', 'email', 'contactemail');
      if (!siteRaw || !email) {
        errors.push(`Row ${i + 2}: missing site URL or email.`);
        continue;
      }

      const siteUrl = siteRaw.startsWith('http') ? siteRaw : `https://${siteRaw}`;
      let companyName = cell('company_name', 'company', 'name');
      if (!companyName) {
        try {
          companyName = new URL(siteUrl).hostname.replace(/^www\./, '');
        } catch {
          companyName = 'Imported';
        }
      }

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
        errors.push(`Row ${i + 2}: no matching niche for "${nicheRaw || '(empty)'}". Use niche labels from your reference list.`);
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
        errors.push(`Row ${i + 2}: unknown country "${countryRaw || '(empty)'}". Use a 2-letter code (US, GB, PK, …).`);
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

      const dr = Number.parseInt(cell('dr', 'domain_rating') || '0', 10) || 0;
      const traffic = Number.parseInt(cell('traffic', 'monthly_traffic') || '0', 10) || 0;
      const gp = Number.parseFloat(cell('guest_post_price', 'guest_post_reselling_price', 'gp_price', 'reseller_price') || '0') || 0;
      const ne = Number.parseFloat(cell('niche_edit_price', 'ne_price') || '0') || 0;

      const dto: VendorBodyDto = {
        companyName,
        siteUrl,
        contactEmail: email,
        nicheIds: nicheIds.slice(0, 5),
        countryIds: countryIds.slice(0, 3),
        languageId: lang.id,
        dr,
        traffic,
        mozDa: Number.parseInt(cell('moz_da', 'da') || '0', 10) || 0,
        authorityScore: Number.parseInt(cell('authority_score', 'as') || '0', 10) || 0,
        referringDomains: Number.parseInt(cell('referring_domains', 'ref_domains') || '0', 10) || 0,
        backlinks: Number.parseInt(cell('backlinks') || '0', 10) || 0,
        trustFlow: Number.parseInt(cell('trust_flow', 'tf') || '0', 10) || 0,
        guestPostCost: Number.parseFloat(cell('guest_post_cost', 'gp_cost') || '0') || 0,
        nicheEditCost: Number.parseFloat(cell('niche_edit_cost', 'ne_cost') || '0') || 0,
        guestPostPrice: gp,
        nicheEditPrice: ne,
        currencyId,
        paymentTerms: PaymentTerms.ADVANCE,
        dealStatus: DealStatus.PENDING,
        tatUnit: TatUnit.DAYS,
        tatValue: Number.parseInt(cell('tat', 'tat_days') || '7', 10) || 7,
        paymentMethodIds: firstPm ? [firstPm.id] : [],
      };

      try {
        await this.vendors.createAnyway(userId, dto);
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
          ? `Successfully imported ${imported} vendor(s).`
          : 'No vendors were imported. Fix errors below and try again.',
    };
  }
}
