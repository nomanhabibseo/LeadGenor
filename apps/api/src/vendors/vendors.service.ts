import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealStatus, OrderStatus, PaymentTerms, Prisma, SeoLinkAttribute, TatUnit } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { joinEmails, parseEmails } from '../common/multi-email';
import { PrismaService } from '../prisma/prisma.service';
import { VendorBodyDto } from './dto/vendor-body.dto';

function toDec(n: number) {
  return new Prisma.Decimal(n);
}

/** Fully resolved vendor payload for Prisma (all optional DTO fields applied). */
type NormalizedVendorBody = {
  companyName: string;
  siteUrl: string;
  nicheIds: string[];
  countryIds: string[];
  languageId: string;
  contactEmail: string;
  traffic: number;
  dr: number;
  mozDa: number;
  authorityScore: number;
  referringDomains: number;
  backlinks: number;
  trustFlow: number;
  seoLinkAttribute: SeoLinkAttribute;
  seoLinkQuantity: number;
  tatUnit: TatUnit;
  tatValue: number;
  currencyId: string;
  guestPostCost: number;
  nicheEditCost: number;
  guestPostPrice: number;
  nicheEditPrice: number;
  paymentTerms: PaymentTerms;
  afterLiveOptionId: string | undefined;
  paymentMethodIds: string[];
  contactPageUrl: string | undefined;
  dealStatus: DealStatus;
  recordDate: string | undefined;
  notes: string | undefined;
};

export type VendorListScope = 'all' | 'deal_done' | 'pending' | 'trash';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoDuplicate(userId: string, normalized: string, excludeId?: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: {
        userId,
        siteUrlNormalized: normalized,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return existing;
  }

  private vendorInclude() {
    return {
      currency: true,
      language: true,
      niches: { include: { niche: true } },
      countries: { include: { country: true } },
      paymentMethods: { include: { paymentMethod: true } },
      afterLiveOption: true,
    } as const;
  }

  private hostFromSiteUrl(siteUrl: string): string {
    try {
      const u = siteUrl.trim().startsWith('http') ? siteUrl.trim() : `https://${siteUrl.trim()}`;
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return 'Site';
    }
  }

  private async defaultLanguageId(): Promise<string> {
    const en = await this.prisma.language.findFirst({
      where: { code: { equals: 'en', mode: 'insensitive' } },
    });
    if (en) return en.id;
    const any = await this.prisma.language.findFirst({ orderBy: { code: 'asc' } });
    if (!any) throw new BadRequestException('No language in database. Run seed.');
    return any.id;
  }

  private async defaultCurrencyId(): Promise<string> {
    const usd = await this.prisma.currency.findFirst({
      where: { code: 'USD' },
      orderBy: { sortOrder: 'asc' },
    });
    if (usd) return usd.id;
    const any = await this.prisma.currency.findFirst({ orderBy: { sortOrder: 'asc' } });
    if (!any) throw new BadRequestException('No currency in database. Run seed.');
    return any.id;
  }

  /** Apply DB defaults for optional fields (client may omit metrics, pricing, payment methods, etc.). */
  private async normalizeVendorBody(dto: VendorBodyDto): Promise<NormalizedVendorBody> {
    const emails = parseEmails(dto.contactEmail);
    if (!emails.length) throw new BadRequestException('At least one valid email is required.');
    const contactEmail = joinEmails(emails);
    const currencyId = dto.currencyId?.trim() || (await this.defaultCurrencyId());
    const paymentTerms = dto.paymentTerms ?? PaymentTerms.ADVANCE;
    const paymentMethodIds = dto.paymentMethodIds ?? [];
    const companyName = (dto.companyName?.trim() || this.hostFromSiteUrl(dto.siteUrl)).slice(0, 240);
    const languageId = dto.languageId?.trim() || (await this.defaultLanguageId());
    return {
      companyName,
      siteUrl: dto.siteUrl,
      nicheIds: dto.nicheIds,
      countryIds: dto.countryIds,
      languageId,
      contactEmail,
      traffic: dto.traffic ?? 0,
      dr: dto.dr ?? 0,
      mozDa: dto.mozDa ?? 0,
      authorityScore: dto.authorityScore ?? 0,
      referringDomains: dto.referringDomains ?? 0,
      backlinks: dto.backlinks ?? 0,
      trustFlow: dto.trustFlow ?? 0,
      seoLinkAttribute: dto.seoLinkAttribute ?? SeoLinkAttribute.DO_FOLLOW,
      seoLinkQuantity: dto.seoLinkQuantity != null && dto.seoLinkQuantity > 0 ? dto.seoLinkQuantity : 1,
      tatUnit: dto.tatUnit ?? TatUnit.DAYS,
      tatValue: dto.tatValue ?? 0,
      currencyId,
      guestPostCost: dto.guestPostCost ?? 0,
      nicheEditCost: dto.nicheEditCost ?? 0,
      guestPostPrice: dto.guestPostPrice ?? 0,
      nicheEditPrice: dto.nicheEditPrice ?? 0,
      paymentTerms,
      afterLiveOptionId:
        paymentTerms === PaymentTerms.AFTER_LIVE_LINK ? dto.afterLiveOptionId?.trim() || undefined : undefined,
      paymentMethodIds,
      contactPageUrl: dto.contactPageUrl,
      dealStatus: dto.dealStatus ?? DealStatus.PENDING,
      recordDate: dto.recordDate,
      notes: dto.notes,
    };
  }

  async create(userId: string, dto: VendorBodyDto) {
    const n = await this.normalizeVendorBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    const dup = await this.assertNoDuplicate(userId, siteUrlNormalized);
    if (dup) throw new BadRequestException({ code: 'DUPLICATE_URL', vendorId: dup.id });

    return this.prisma.vendor.create({
      data: {
        userId,
        companyName: n.companyName,
        siteUrl: n.siteUrl.trim(),
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        trustFlow: n.trustFlow,
        seoLinkAttribute: n.seoLinkAttribute,
        seoLinkQuantity: n.seoLinkQuantity,
        tatUnit: n.tatUnit,
        tatValue: n.tatValue,
        currencyId: n.currencyId,
        guestPostCost: toDec(n.guestPostCost),
        nicheEditCost: toDec(n.nicheEditCost),
        guestPostPrice: toDec(n.guestPostPrice),
        nicheEditPrice: toDec(n.nicheEditPrice),
        paymentTerms: n.paymentTerms,
        afterLiveOptionId: n.afterLiveOptionId ?? null,
        contactEmail: n.contactEmail,
        contactPageUrl: n.contactPageUrl ?? null,
        dealStatus: n.dealStatus,
        recordDate: n.recordDate ? new Date(n.recordDate) : null,
        notes: n.notes ?? null,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
        paymentMethods: { create: n.paymentMethodIds.map((paymentMethodId) => ({ paymentMethodId })) },
      },
      include: this.vendorInclude(),
    });
  }

  async createAnyway(userId: string, dto: VendorBodyDto) {
    const n = await this.normalizeVendorBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    return this.prisma.vendor.create({
      data: {
        userId,
        companyName: n.companyName,
        siteUrl: n.siteUrl.trim(),
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        trustFlow: n.trustFlow,
        seoLinkAttribute: n.seoLinkAttribute,
        seoLinkQuantity: n.seoLinkQuantity,
        tatUnit: n.tatUnit,
        tatValue: n.tatValue,
        currencyId: n.currencyId,
        guestPostCost: toDec(n.guestPostCost),
        nicheEditCost: toDec(n.nicheEditCost),
        guestPostPrice: toDec(n.guestPostPrice),
        nicheEditPrice: toDec(n.nicheEditPrice),
        paymentTerms: n.paymentTerms,
        afterLiveOptionId: n.afterLiveOptionId ?? null,
        contactEmail: n.contactEmail,
        contactPageUrl: n.contactPageUrl ?? null,
        dealStatus: n.dealStatus,
        recordDate: n.recordDate ? new Date(n.recordDate) : null,
        notes: n.notes ?? null,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
        paymentMethods: { create: n.paymentMethodIds.map((paymentMethodId) => ({ paymentMethodId })) },
      },
      include: this.vendorInclude(),
    });
  }

  async update(userId: string, id: string, dto: VendorBodyDto) {
    const n = await this.normalizeVendorBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    const dup = await this.assertNoDuplicate(userId, siteUrlNormalized, id);
    if (dup) throw new BadRequestException({ code: 'DUPLICATE_URL', vendorId: dup.id });

    await this.prisma.vendorNiche.deleteMany({ where: { vendorId: id } });
    await this.prisma.vendorCountry.deleteMany({ where: { vendorId: id } });
    await this.prisma.vendorPaymentMethod.deleteMany({ where: { vendorId: id } });

    return this.prisma.vendor.update({
      where: { id, userId, deletedAt: null },
      data: {
        companyName: n.companyName,
        siteUrl: n.siteUrl.trim(),
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        trustFlow: n.trustFlow,
        seoLinkAttribute: n.seoLinkAttribute,
        seoLinkQuantity: n.seoLinkQuantity,
        tatUnit: n.tatUnit,
        tatValue: n.tatValue,
        currencyId: n.currencyId,
        guestPostCost: toDec(n.guestPostCost),
        nicheEditCost: toDec(n.nicheEditCost),
        guestPostPrice: toDec(n.guestPostPrice),
        nicheEditPrice: toDec(n.nicheEditPrice),
        paymentTerms: n.paymentTerms,
        afterLiveOptionId: n.afterLiveOptionId ?? null,
        contactEmail: n.contactEmail,
        contactPageUrl: n.contactPageUrl ?? null,
        dealStatus: n.dealStatus,
        recordDate: n.recordDate ? new Date(n.recordDate) : null,
        notes: n.notes ?? null,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
        paymentMethods: { create: n.paymentMethodIds.map((paymentMethodId) => ({ paymentMethodId })) },
      },
      include: this.vendorInclude(),
    });
  }

  async findOne(userId: string, id: string) {
    const v = await this.prisma.vendor.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        ...this.vendorInclude(),
        _count: {
          select: {
            orders: {
              where: { deletedAt: null, status: OrderStatus.COMPLETED },
            },
          },
        },
      },
    });
    if (!v) throw new NotFoundException();
    return v;
  }

  async list(
    userId: string,
    scope: VendorListScope,
    q: {
      page: number;
      limit: number;
      searchUrl?: string;
      dealStatus?: DealStatus;
      drMin?: number;
      drMax?: number;
      trafficMin?: number;
      trafficMax?: number;
      refMin?: number;
      refMax?: number;
      gpPriceMin?: number;
      gpPriceMax?: number;
      nePriceMin?: number;
      nePriceMax?: number;
      dateFrom?: string;
      dateTo?: string;
      nicheIds?: string[];
      nicheMode?: 'include' | 'exclude';
      countryIds?: string[];
      countryMode?: 'include' | 'exclude';
      languageId?: string;
      paymentTerms?: PaymentTerms;
      mozDaMin?: number;
      mozDaMax?: number;
      authorityScoreMin?: number;
      authorityScoreMax?: number;
      tatValueMin?: number;
      tatValueMax?: number;
      backlinksMin?: number;
      backlinksMax?: number;
    },
  ) {
    const where: Prisma.VendorWhereInput = { userId };

    if (scope === 'trash') {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
      if (scope === 'deal_done') where.dealStatus = DealStatus.DEAL_DONE;
      if (scope === 'pending') where.dealStatus = DealStatus.PENDING;
    }

    if (q.dealStatus && scope === 'all') where.dealStatus = q.dealStatus;

    if (q.searchUrl) {
      where.siteUrlNormalized = {
        contains: normalizeSiteUrl(q.searchUrl).replace(/^https?:\/\//, ''),
        mode: 'insensitive',
      };
    }

    if (q.drMin != null || q.drMax != null) {
      where.dr = {};
      if (q.drMin != null) where.dr.gte = q.drMin;
      if (q.drMax != null) where.dr.lte = q.drMax;
    }
    if (q.trafficMin != null || q.trafficMax != null) {
      where.traffic = {};
      if (q.trafficMin != null) where.traffic.gte = q.trafficMin;
      if (q.trafficMax != null) where.traffic.lte = q.trafficMax;
    }
    if (q.refMin != null || q.refMax != null) {
      where.referringDomains = {};
      if (q.refMin != null) where.referringDomains.gte = q.refMin;
      if (q.refMax != null) where.referringDomains.lte = q.refMax;
    }
    if (q.gpPriceMin != null || q.gpPriceMax != null) {
      where.guestPostPrice = {};
      if (q.gpPriceMin != null) where.guestPostPrice.gte = toDec(q.gpPriceMin);
      if (q.gpPriceMax != null) where.guestPostPrice.lte = toDec(q.gpPriceMax);
    }
    if (q.nePriceMin != null || q.nePriceMax != null) {
      where.nicheEditPrice = {};
      if (q.nePriceMin != null) where.nicheEditPrice.gte = toDec(q.nePriceMin);
      if (q.nePriceMax != null) where.nicheEditPrice.lte = toDec(q.nePriceMax);
    }
    if (q.dateFrom || q.dateTo) {
      where.recordDate = {};
      if (q.dateFrom) where.recordDate.gte = new Date(q.dateFrom);
      if (q.dateTo) where.recordDate.lte = new Date(q.dateTo);
    }

    if (q.nicheIds?.length) {
      where.niches =
        q.nicheMode === 'exclude'
          ? { none: { nicheId: { in: q.nicheIds } } }
          : { some: { nicheId: { in: q.nicheIds } } };
    }

    if (q.countryIds?.length) {
      where.countries =
        q.countryMode === 'exclude'
          ? { none: { countryId: { in: q.countryIds } } }
          : { some: { countryId: { in: q.countryIds } } };
    }

    if (q.languageId) {
      where.languageId = q.languageId;
    }
    if (q.paymentTerms) {
      where.paymentTerms = q.paymentTerms;
    }
    if (q.mozDaMin != null || q.mozDaMax != null) {
      where.mozDa = {};
      if (q.mozDaMin != null) where.mozDa.gte = q.mozDaMin;
      if (q.mozDaMax != null) where.mozDa.lte = q.mozDaMax;
    }
    if (q.authorityScoreMin != null || q.authorityScoreMax != null) {
      where.authorityScore = {};
      if (q.authorityScoreMin != null) where.authorityScore.gte = q.authorityScoreMin;
      if (q.authorityScoreMax != null) where.authorityScore.lte = q.authorityScoreMax;
    }
    if (q.tatValueMin != null || q.tatValueMax != null) {
      where.tatValue = {};
      if (q.tatValueMin != null) where.tatValue.gte = q.tatValueMin;
      if (q.tatValueMax != null) where.tatValue.lte = q.tatValueMax;
    }
    if (q.backlinksMin != null || q.backlinksMax != null) {
      where.backlinks = {};
      if (q.backlinksMin != null) where.backlinks.gte = q.backlinksMin;
      if (q.backlinksMax != null) where.backlinks.lte = q.backlinksMax;
    }

    const total = await this.prisma.vendor.count({ where });

    // Order by "most completed orders" across pagination.
    // We cap the scan to avoid heavy queries for extremely large datasets.
    const MAX_SORT_SCAN = 2000;
    const all = await this.prisma.vendor.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(total, MAX_SORT_SCAN),
    });
    const idsAll = all.map((r) => r.id);
    const countsAll =
      idsAll.length === 0
        ? []
        : await this.prisma.order.groupBy({
            by: ['vendorId'],
            where: { userId, vendorId: { in: idsAll }, status: OrderStatus.COMPLETED, deletedAt: null },
            _count: { _all: true },
          });
    const countMap = new Map(countsAll.map((c) => [c.vendorId, c._count._all]));

    const sorted = [...all].sort((a, b) => {
      const ca = countMap.get(a.id) ?? 0;
      const cb = countMap.get(b.id) ?? 0;
      if (ca !== cb) return cb - ca;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const pageIds = sorted
      .slice((q.page - 1) * q.limit, (q.page - 1) * q.limit + q.limit)
      .map((r) => r.id);
    const rows =
      pageIds.length === 0
        ? []
        : await this.prisma.vendor.findMany({
            where: { id: { in: pageIds } },
            include: {
              currency: true,
              language: true,
              niches: { include: { niche: true } },
              countries: { include: { country: true } },
            },
          });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({
        ...(r as (typeof rows)[number]),
        completedOrderCount: countMap.get((r as (typeof rows)[number]).id) ?? 0,
      }));

    return { data, total, page: q.page, limit: q.limit };
  }

  async softDelete(userId: string, id: string) {
    return this.prisma.vendor.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /** Quick undo within 5s of soft-delete */
  async restoreQuick(userId: string, id: string) {
    const v = await this.prisma.vendor.findFirst({ where: { id, userId } });
    if (!v?.deletedAt) throw new NotFoundException();
    const elapsed = Date.now() - v.deletedAt.getTime();
    if (elapsed > 5000) throw new BadRequestException('Undo window expired');
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async restoreFromTrash(userId: string, id: string) {
    const v = await this.prisma.vendor.findFirst({ where: { id, userId, deletedAt: { not: null } } });
    if (!v) throw new NotFoundException();
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async permanentDelete(userId: string, id: string) {
    await this.prisma.vendor.delete({ where: { id, userId } });
    return { ok: true };
  }

  async bulkPriceAdjustDealDone(userId: string, percent: number, applyGuestPost: boolean, applyNicheEdit: boolean) {
    if (!applyGuestPost && !applyNicheEdit) {
      throw new BadRequestException('Select guest post and/or niche edit resell pricing to adjust.');
    }
    const vendors = await this.prisma.vendor.findMany({
      where: { userId, dealStatus: DealStatus.DEAL_DONE, deletedAt: null },
    });
    const factor = 1 + percent / 100;
    for (const v of vendors) {
      await this.prisma.vendor.update({
        where: { id: v.id },
        data: {
          ...(applyGuestPost
            ? { guestPostPrice: v.guestPostPrice.mul(factor) }
            : {}),
          ...(applyNicheEdit ? { nicheEditPrice: v.nicheEditPrice.mul(factor) } : {}),
        },
      });
    }
    return { updated: vendors.length };
  }

  async purgeExpiredTrash(userId: string, retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 86400000);
    const res = await this.prisma.vendor.deleteMany({
      where: {
        userId,
        deletedAt: { not: null, lt: cutoff },
      },
    });
    return { deleted: res.count };
  }
}
