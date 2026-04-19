import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { joinEmails, parseEmails } from '../common/multi-email';
import { PrismaService } from '../prisma/prisma.service';
import { ClientBodyDto } from './dto/client-body.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoDuplicate(userId: string, normalized: string, excludeId?: string) {
    return this.prisma.client.findFirst({
      where: {
        userId,
        siteUrlNormalized: normalized,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  private include() {
    return {
      language: true,
      niches: { include: { niche: true } },
      countries: { include: { country: true } },
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

  private async normalizeClientBody(dto: ClientBodyDto) {
    const emails = parseEmails(dto.email);
    if (!emails.length) throw new BadRequestException('At least one valid email is required.');
    const email = joinEmails(emails);
    const host = this.hostFromSiteUrl(dto.siteUrl);
    const companyName = (dto.companyName?.trim() || host).slice(0, 240);
    const clientName = (dto.clientName?.trim() || host).slice(0, 240);
    const languageId = dto.languageId?.trim() || (await this.defaultLanguageId());
    return {
      companyName,
      clientName,
      siteUrl: dto.siteUrl.trim(),
      nicheIds: dto.nicheIds,
      countryIds: dto.countryIds,
      languageId,
      email,
      traffic: dto.traffic ?? 0,
      dr: dto.dr ?? 0,
      mozDa: dto.mozDa ?? 0,
      authorityScore: dto.authorityScore ?? 0,
      referringDomains: dto.referringDomains ?? 0,
      backlinks: dto.backlinks ?? 0,
      whatsapp: dto.whatsapp?.trim() || null,
    };
  }

  async create(userId: string, dto: ClientBodyDto) {
    const n = await this.normalizeClientBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    const dup = await this.assertNoDuplicate(userId, siteUrlNormalized);
    if (dup) throw new BadRequestException({ code: 'DUPLICATE_URL', clientId: dup.id });

    return this.prisma.client.create({
      data: {
        userId,
        companyName: n.companyName,
        clientName: n.clientName,
        siteUrl: n.siteUrl,
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        email: n.email,
        whatsapp: n.whatsapp,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
      },
      include: this.include(),
    });
  }

  async createAnyway(userId: string, dto: ClientBodyDto) {
    const n = await this.normalizeClientBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    return this.prisma.client.create({
      data: {
        userId,
        companyName: n.companyName,
        clientName: n.clientName,
        siteUrl: n.siteUrl,
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        email: n.email,
        whatsapp: n.whatsapp,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
      },
      include: this.include(),
    });
  }

  async update(userId: string, id: string, dto: ClientBodyDto) {
    const n = await this.normalizeClientBody(dto);
    const siteUrlNormalized = normalizeSiteUrl(n.siteUrl);
    const dup = await this.assertNoDuplicate(userId, siteUrlNormalized, id);
    if (dup) throw new BadRequestException({ code: 'DUPLICATE_URL', clientId: dup.id });

    await this.prisma.clientNiche.deleteMany({ where: { clientId: id } });
    await this.prisma.clientCountry.deleteMany({ where: { clientId: id } });

    return this.prisma.client.update({
      where: { id, userId, deletedAt: null },
      data: {
        companyName: n.companyName,
        clientName: n.clientName,
        siteUrl: n.siteUrl,
        siteUrlNormalized,
        traffic: n.traffic,
        dr: n.dr,
        mozDa: n.mozDa,
        authorityScore: n.authorityScore,
        referringDomains: n.referringDomains,
        backlinks: n.backlinks,
        email: n.email,
        whatsapp: n.whatsapp,
        languageId: n.languageId,
        niches: { create: n.nicheIds.map((nicheId) => ({ nicheId })) },
        countries: { create: n.countryIds.map((countryId) => ({ countryId })) },
      },
      include: this.include(),
    });
  }

  async findOne(userId: string, id: string) {
    const c = await this.prisma.client.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        ...this.include(),
        _count: {
          select: {
            orders: { where: { deletedAt: null, status: OrderStatus.COMPLETED } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException();
    return c;
  }

  async list(
    userId: string,
    scope: 'active' | 'trash',
    q: {
      page: number;
      limit: number;
      searchUrl?: string;
      drMin?: number;
      drMax?: number;
      trafficMin?: number;
      trafficMax?: number;
      nicheIds?: string[];
      nicheMode?: 'include' | 'exclude';
      countryIds?: string[];
      countryMode?: 'include' | 'exclude';
      languageId?: string;
      mozDaMin?: number;
      mozDaMax?: number;
      authorityScoreMin?: number;
      authorityScoreMax?: number;
      referringDomainsMin?: number;
      referringDomainsMax?: number;
      backlinksMin?: number;
      backlinksMax?: number;
    },
  ) {
    const where: Prisma.ClientWhereInput = { userId };
    if (scope === 'trash') where.deletedAt = { not: null };
    else where.deletedAt = null;

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
    if (q.referringDomainsMin != null || q.referringDomainsMax != null) {
      where.referringDomains = {};
      if (q.referringDomainsMin != null) where.referringDomains.gte = q.referringDomainsMin;
      if (q.referringDomainsMax != null) where.referringDomains.lte = q.referringDomainsMax;
    }
    if (q.backlinksMin != null || q.backlinksMax != null) {
      where.backlinks = {};
      if (q.backlinksMin != null) where.backlinks.gte = q.backlinksMin;
      if (q.backlinksMax != null) where.backlinks.lte = q.backlinksMax;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: this.include(),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const ids = rows.map((r) => r.id);
    const counts =
      ids.length === 0
        ? []
        : await this.prisma.order.groupBy({
            by: ['clientId'],
            where: {
              userId,
              clientId: { in: ids },
              status: OrderStatus.COMPLETED,
              deletedAt: null,
            },
            _count: { _all: true },
          });
    const countMap = new Map(counts.map((c) => [c.clientId, c._count._all]));
    rows.sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0));

    return {
      data: rows.map((r) => ({ ...r, completedOrderCount: countMap.get(r.id) ?? 0 })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async softDelete(userId: string, id: string) {
    return this.prisma.client.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async restoreQuick(userId: string, id: string) {
    const v = await this.prisma.client.findFirst({ where: { id, userId } });
    if (!v?.deletedAt) throw new NotFoundException();
    if (Date.now() - v.deletedAt.getTime() > 5000) throw new BadRequestException('Undo window expired');
    return this.prisma.client.update({ where: { id }, data: { deletedAt: null } });
  }

  async restoreFromTrash(userId: string, id: string) {
    const v = await this.prisma.client.findFirst({ where: { id, userId, deletedAt: { not: null } } });
    if (!v) throw new NotFoundException();
    return this.prisma.client.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(userId: string, id: string) {
    await this.prisma.client.delete({ where: { id, userId } });
    return { ok: true };
  }
}
