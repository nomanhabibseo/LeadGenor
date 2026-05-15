import { Injectable } from '@nestjs/common';
import * as Papa from 'papaparse';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { ClientsService } from '../clients/clients.service';
import type { ClientBodyDto } from '../clients/dto/client-body.dto';
import { PrismaService } from '../prisma/prisma.service';
import { parseAbbreviatedMetricInt } from '../common/parse-abbreviated-metric-int';
import { websiteNameFromSiteUrl } from '../common/website-name-from-url';
import {
  matchBestLanguage,
  resolveCountryIdsFromRaw,
  resolveNicheIdsFromRaw,
} from './reference-match';
import { normHeader } from '../email-marketing/email-list-import';
import type { ImportStreamHooks } from './import-stream-hooks';

type ClientCandidate = {
  rowLabel: number;
  norm: string;
  displayUrl: string;
  dto: ClientBodyDto;
};

@Injectable()
export class ImportClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  async importFromCsvText(userId: string, csv: string, hooks?: ImportStreamHooks | null) {
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const rawRows = parsed.data.filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim()));

    const [niches, countries, languages] = await Promise.all([
      this.prisma.niche.findMany(),
      this.prisma.country.findMany(),
      this.prisma.language.findMany(),
    ]);

    const candidates: ClientCandidate[] = [];
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
        companyName = websiteNameFromSiteUrl(siteUrl) || 'Imported';
      }
      if (!clientName) clientName = companyName;

      const nicheRaw = cell('niche', 'niches', 'category');
      const nicheIds = nicheRaw ? resolveNicheIdsFromRaw(nicheRaw, niches) : [];
      if (nicheIds.length === 0) {
        errors.push(`Row ${i + 2}: no matching niche for "${nicheRaw || '(empty)'}".`);
        continue;
      }

      const countryRaw = cell('country', 'country_code');
      const countryIds = countryRaw ? resolveCountryIdsFromRaw(countryRaw, countries) : [];
      if (countryIds.length === 0) {
        errors.push(`Row ${i + 2}: unknown country "${countryRaw || '(empty)'}".`);
        continue;
      }

      const langRaw = cell('language', 'lang') || 'en';
      const lang = matchBestLanguage(langRaw, languages);
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
        traffic: parseAbbreviatedMetricInt(cell('traffic', 'monthly_traffic')),
        dr: Number.parseInt(cell('dr', 'domain_rating') || '0', 10) || 0,
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
        whatsapp: cell('whatsapp', 'phone') || undefined,
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
        ? await this.prisma.client.findMany({
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
        await this.clients.createAnywayForImport(userId, c.dto);
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
          ? `Import stopped. ${imported} client(s) were saved before cancel.`
          : 'Import stopped before any new clients were saved.';
    } else if (imported > 0) {
      message = `Successfully imported ${imported} client(s).`;
    } else if (uniqueSkipped.length > 0 && errors.length === 0) {
      message = 'No new clients were imported — all site URLs already exist in your data.';
    } else {
      message = 'No clients were imported. Fix errors below and try again.';
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

