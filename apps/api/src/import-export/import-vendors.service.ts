import { BadRequestException, Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { DealStatus, PaymentTerms, TatUnit } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { VendorsService } from '../vendors/vendors.service';
import type { VendorBodyDto } from '../vendors/dto/vendor-body.dto';
import { parseAbbreviatedMetricInt } from '../common/parse-abbreviated-metric-int';
import { websiteNameFromSiteUrl } from '../common/website-name-from-url';
import {
  matchBestLanguage,
  resolveCountryIdsFromRaw,
  resolveNicheIdsFromRaw,
} from './reference-match';
import { normHeader } from '../email-marketing/email-list-import';
import { parseVendorDealStatusFromImport } from './parse-vendor-deal-status';
import type { ImportStreamHooks } from './import-stream-hooks';

type VendorCandidate = {
  rowLabel: number;
  norm: string;
  displayUrl: string;
  dto: VendorBodyDto;
};

@Injectable()
export class ImportVendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendors: VendorsService,
  ) {}

  async importFromCsvText(userId: string, csv: string, hooks?: ImportStreamHooks | null) {
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

    const candidates: VendorCandidate[] = [];
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
        companyName = websiteNameFromSiteUrl(siteUrl) || 'Imported';
      }

      const nicheRaw = cell('niche', 'niches', 'category');
      const nicheIds = nicheRaw ? resolveNicheIdsFromRaw(nicheRaw, niches) : [];
      if (nicheIds.length === 0) {
        errors.push(
          `Row ${i + 2}: no matching niche for "${nicheRaw || '(empty)'}". Try labels like your app niches (abbreviations like "tech" are matched automatically).`,
        );
        continue;
      }

      const countryRaw = cell('country', 'country_code');
      const countryIds = countryRaw ? resolveCountryIdsFromRaw(countryRaw, countries) : [];
      if (countryIds.length === 0) {
        errors.push(
          `Row ${i + 2}: unknown country "${countryRaw || '(empty)'}". Use a country name or 2-letter code (US, LK, …).`,
        );
        continue;
      }

      const langRaw = cell('language', 'lang') || 'en';
      const lang = matchBestLanguage(langRaw, languages);
      if (!lang) {
        errors.push(`Row ${i + 2}: unknown language "${langRaw}".`);
        continue;
      }

      const dr = Number.parseInt(cell('dr', 'domain_rating') || '0', 10) || 0;
      const traffic = parseAbbreviatedMetricInt(cell('traffic', 'monthly_traffic'));
      const gp = Number.parseFloat(cell('guest_post_price', 'guest_post_reselling_price', 'gp_price', 'reseller_price') || '0') || 0;
      const ne = Number.parseFloat(cell('niche_edit_price', 'ne_price') || '0') || 0;
      const dealStatusRaw = cell('deal_status', 'dealstatus', 'deal');
      const dealStatus = parseVendorDealStatusFromImport(dealStatusRaw);

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
        referringDomains: parseAbbreviatedMetricInt(
          cell(
            'referring_domains',
            'ref_domains',
            'def_domains',
            'referring_domain',
            'ref_domain',
            'ref_domains_ips',
            'def_domains_ips',
          ),
        ),
        backlinks: parseAbbreviatedMetricInt(cell('backlinks')),
        trustFlow: Number.parseInt(cell('trust_flow', 'tf') || '0', 10) || 0,
        guestPostCost: Number.parseFloat(cell('guest_post_cost', 'gp_cost') || '0') || 0,
        nicheEditCost: Number.parseFloat(cell('niche_edit_cost', 'ne_cost') || '0') || 0,
        guestPostPrice: gp,
        nicheEditPrice: ne,
        currencyId,
        paymentTerms: PaymentTerms.ADVANCE,
        dealStatus,
        tatUnit: TatUnit.DAYS,
        tatValue: Number.parseInt(cell('tat', 'tat_days') || '7', 10) || 7,
        paymentMethodIds: firstPm ? [firstPm.id] : [],
      };

      const norm = normalizeSiteUrl(siteUrl);
      candidates.push({
        rowLabel: i + 2,
        norm,
        displayUrl: siteUrl.trim(),
        dto,
      });
    }

    const norms = [...new Set(candidates.map((c) => c.norm))];
    const existingRows =
      norms.length > 0
        ? await this.prisma.vendor.findMany({
            where: { userId, deletedAt: null, siteUrlNormalized: { in: norms } },
            select: { siteUrlNormalized: true },
          })
        : [];
    const seen = new Set(existingRows.map((e) => e.siteUrlNormalized));

    const skippedDisplayUrls: string[] = [];
    let imported = 0;
    let cancelledEarly = false;
    const totalRows = candidates.length;

    for (const c of candidates) {
      if (hooks?.isCancelled?.()) {
        cancelledEarly = true;
        break;
      }
      if (seen.has(c.norm)) {
        skippedDisplayUrls.push(c.displayUrl);
        continue;
      }
      try {
        await this.vendors.createAnywayForImport(userId, c.dto);
        imported++;
        seen.add(c.norm);
        hooks?.onProgress?.({ imported, totalRows });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Row ${c.rowLabel}: ${msg}`);
      }
    }

    const uniqueSkipped = [...new Set(skippedDisplayUrls)];

    let message: string;
    if (cancelledEarly) {
      message =
        imported > 0
          ? `Import stopped. ${imported} vendor(s) were saved before cancel.`
          : 'Import stopped before any new vendors were saved.';
    } else if (imported > 0) {
      message = `Successfully imported ${imported} vendor(s).`;
    } else if (uniqueSkipped.length > 0 && errors.length === 0) {
      message = 'No new vendors were imported — all site URLs already exist in your data.';
    } else {
      message = 'No vendors were imported. Fix errors below and try again.';
    }

    return {
      imported,
      failed: rawRows.length - imported,
      errors: errors.slice(0, 30),
      skippedExistingCount: uniqueSkipped.length,
      skippedExistingUrls: uniqueSkipped.slice(0, 400),
      message,
      cancelled: cancelledEarly,
    };
  }
}

