import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DealStatus,
  EmailListAutoUpdate,
  EmailRiskLevel,
  ListContactKind,
  Prisma,
} from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { parseEmailListCsv } from './email-list-import';
import { fetchGoogleSheetAsCsv } from './google-sheet-csv';

@Injectable()
export class EmailListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionService,
  ) {}

  async list(userId: string) {
    return this.prisma.emailList.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ campaigns: { _count: 'desc' } }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { items: true, campaigns: true } },
        campaigns: {
          where: { completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { completedAt: true },
        },
      },
    });
  }

  async listDeleted(userId: string) {
    return this.prisma.emailList.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: [{ campaigns: { _count: 'desc' } }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { items: true, campaigns: true } },
      },
    });
  }

  async create(userId: string, name: string) {
    const n = name.trim();
    if (!n) throw new BadRequestException('List name is required.');
    const dup = await this.prisma.emailList.findFirst({
      where: {
        userId,
        deletedAt: null,
        name: { equals: n, mode: 'insensitive' },
      },
    });
    if (dup) {
      throw new ConflictException(
        'A list with this name already exists. Please choose a different name.',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.subscription.assertAndConsumeNewList(userId, tx);
        return tx.emailList.create({
          data: { userId, name: n, autoUpdate: EmailListAutoUpdate.OFF },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'A list with this name already exists. Please choose a different name.',
        );
      }
      throw e;
    }
  }

  async update(
    userId: string,
    id: string,
    body: { name?: string; autoUpdate?: EmailListAutoUpdate },
  ) {
    const list = await this.prisma.emailList.findFirst({ where: { id, userId, deletedAt: null } });
    if (!list) throw new NotFoundException('List not found.');
    try {
      return await this.prisma.emailList.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.autoUpdate !== undefined ? { autoUpdate: body.autoUpdate } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'A list with this name already exists. Please choose a different name.',
        );
      }
      throw e;
    }
  }

  async softDelete(userId: string, id: string) {
    const list = await this.prisma.emailList.findFirst({ where: { id, userId, deletedAt: null } });
    if (!list) throw new NotFoundException('List not found.');
    await this.prisma.emailList.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async restore(userId: string, id: string) {
    const list = await this.prisma.emailList.findFirst({ where: { id, userId } });
    if (!list) throw new NotFoundException('List not found.');
    await this.prisma.emailList.update({ where: { id }, data: { deletedAt: null } });
    return { ok: true };
  }

  async get(userId: string, id: string) {
    const list = await this.prisma.emailList.findFirst({
      where: { id, userId, deletedAt: null },
      include: { _count: { select: { items: true } } },
    });
    if (!list) throw new NotFoundException('List not found.');
    return list;
  }

  async listItems(userId: string, listId: string, page = 1, limit = 50) {
    await this.get(userId, listId);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.emailListItem.findMany({
        where: { listId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailListItem.count({ where: { listId } }),
    ]);
    return { items, total, page, limit };
  }

  async addItems(userId: string, listId: string, rows: ReturnType<typeof parseEmailListCsv>['rows']) {
    await this.get(userId, listId);
    if (!rows.length) return { added: 0 };
    let newCreatesPlanned = 0;
    for (const r of rows) {
      const existing = await this.prisma.emailListItem.findFirst({
        where: { listId, siteUrlNormalized: r.siteUrlNormalized },
      });
      if (!existing) newCreatesPlanned++;
    }
    let added = 0;
    return await this.prisma.$transaction(async (tx) => {
      await this.subscription.assertConsumeProspectsAdded(tx, userId, newCreatesPlanned);
      for (const r of rows) {
        const existing = await tx.emailListItem.findFirst({
          where: { listId, siteUrlNormalized: r.siteUrlNormalized },
        });
        const payload = {
          siteUrl: r.siteUrl,
          siteUrlNormalized: r.siteUrlNormalized,
          companyName: r.companyName,
          contactName: r.contactName,
          contactKind: r.contactKind,
          niche: r.niche,
          country: r.country,
          traffic: r.traffic,
          dr: r.dr,
          da: r.da,
          authorityScore: r.authorityScore,
          backlinks: r.backlinks,
          referringDomains: r.referringDomains,
          emails: r.emails as unknown as Prisma.InputJsonValue,
          emailRisk: r.emailRisk,
        };
        if (existing) {
          await tx.emailListItem.update({ where: { id: existing.id }, data: payload });
        } else {
          await tx.emailListItem.create({ data: { listId, ...payload } });
          added++;
        }
      }
      return { added };
    });
  }

  async removeItems(userId: string, listId: string, itemIds: string[]) {
    await this.get(userId, listId);
    const deleted = await this.prisma.emailListItem.deleteMany({
      where: { listId, id: { in: itemIds } },
    });
    return { deleted: deleted.count };
  }

  async setItemEmails(userId: string, listId: string, itemId: string, emails: string[]) {
    await this.get(userId, listId);
    const row = await this.prisma.emailListItem.findFirst({ where: { id: itemId, listId } });
    if (!row) throw new NotFoundException('List item not found.');
    const cleaned = Array.from(
      new Set(
        (emails ?? [])
          .map((e) => String(e).trim())
          .filter(Boolean)
          .map((e) => e.toLowerCase()),
      ),
    );
    await this.prisma.emailListItem.update({
      where: { id: itemId },
      data: { emails: cleaned as unknown as Prisma.InputJsonValue },
    });
    return { ok: true, emails: cleaned };
  }

  async importCsv(userId: string, listId: string, csv: string) {
    const { rows, errors } = parseEmailListCsv(csv);
    const added = await this.addItems(userId, listId, rows);
    return { ...added, errors };
  }

  async importSheetUrl(userId: string, listId: string, url: string) {
    const csv = await fetchGoogleSheetAsCsv(url);
    return this.importCsv(userId, listId, csv);
  }

  async importFromVendors(userId: string, listId: string, vendorIds: string[]) {
    await this.get(userId, listId);
    if (!vendorIds.length) return { added: 0 };
    const vendors = await this.prisma.vendor.findMany({
      where: {
        userId,
        id: { in: vendorIds },
        deletedAt: null,
        dealStatus: DealStatus.PENDING,
      },
      include: { niches: { include: { niche: true } }, countries: { include: { country: true } } },
    });
    const rows = vendors.map((v) => ({
      siteUrl: v.siteUrl,
      siteUrlNormalized: v.siteUrlNormalized,
      companyName: v.companyName,
      contactName: v.companyName,
      contactKind: ListContactKind.VENDOR,
      niche: v.niches[0]?.niche.label ?? '',
      country: v.countries.map((c) => c.country.code).filter(Boolean).join(', '),
      traffic: v.traffic,
      dr: v.dr,
      da: v.mozDa,
      authorityScore: v.authorityScore,
      backlinks: v.backlinks,
      referringDomains: v.referringDomains,
      emails: [v.contactEmail].filter(Boolean),
      emailRisk: EmailRiskLevel.UNKNOWN,
    }));
    return this.addItems(userId, listId, rows);
  }

  async importFromClients(userId: string, listId: string, clientIds: string[]) {
    await this.get(userId, listId);
    if (!clientIds.length) return { added: 0 };
    const clients = await this.prisma.client.findMany({
      where: { userId, id: { in: clientIds }, deletedAt: null },
      include: { niches: { include: { niche: true } }, countries: { include: { country: true } } },
    });
    const rows = clients.map((c) => ({
      siteUrl: c.siteUrl,
      siteUrlNormalized: c.siteUrlNormalized,
      companyName: c.companyName,
      contactName: c.clientName,
      contactKind: ListContactKind.CLIENT,
      niche: c.niches[0]?.niche.label ?? '',
      country: c.countries.map((x) => x.country.code).filter(Boolean).join(', '),
      traffic: c.traffic,
      dr: c.dr,
      da: c.mozDa,
      authorityScore: c.authorityScore,
      backlinks: c.backlinks,
      referringDomains: c.referringDomains,
      emails: [c.email].filter(Boolean),
      emailRisk: EmailRiskLevel.UNKNOWN,
    }));
    return this.addItems(userId, listId, rows);
  }

  async exportCsv(userId: string, listId: string, itemIds?: string[]) {
    await this.get(userId, listId);
    const items = await this.prisma.emailListItem.findMany({
      where: { listId, ...(itemIds?.length ? { id: { in: itemIds } } : {}) },
      orderBy: { siteUrl: 'asc' },
    });
    const rows = items.map((it) => {
      const emails = (it.emails as unknown as string[]) ?? [];
      return {
        site_url: it.siteUrl,
        company_name: it.companyName,
        contact_name: it.contactName,
        contact_kind: it.contactKind,
        niche: it.niche,
        country: it.country,
        traffic: it.traffic,
        dr: it.dr,
        da: it.da,
        authority_score: it.authorityScore,
        backlinks: it.backlinks,
        referring_domains: it.referringDomains,
        emails: emails.join('; '),
      };
    });
    return Papa.unparse(rows);
  }

  async exportPdf(userId: string, listId: string, itemIds?: string[]) {
    await this.get(userId, listId);
    const items = await this.prisma.emailListItem.findMany({
      where: { listId, ...(itemIds?.length ? { id: { in: itemIds } } : {}) },
      orderBy: { siteUrl: 'asc' },
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(10);
    let y = 40;
    doc.text('Site URL | Company | Contact | Traffic | DR | Emails', 40, y);
    y += 14;
    for (const it of items) {
      const emails = ((it.emails as unknown as string[]) ?? []).join(', ');
      const line = `${it.siteUrl} | ${it.companyName} | ${it.contactName} | ${it.traffic} | ${it.dr} | ${emails}`;
      const chunks = doc.splitTextToSize(line, 750);
      for (const ch of chunks) {
        if (y > 520) {
          doc.addPage();
          y = 40;
        }
        doc.text(ch, 40, y);
        y += 12;
      }
    }
    return doc.output('arraybuffer') as ArrayBuffer;
  }

  async syncListFromDatabanks(userId: string, listId: string) {
    const list = await this.get(userId, listId);
    const items = await this.prisma.emailListItem.findMany({ where: { listId } });
    let updated = 0;
    for (const it of items) {
      const v = await this.prisma.vendor.findFirst({
        where: { userId, siteUrlNormalized: it.siteUrlNormalized, deletedAt: null },
        include: { niches: { include: { niche: true } }, countries: { include: { country: true } } },
      });
      if (v) {
        await this.prisma.emailListItem.update({
          where: { id: it.id },
          data: {
            companyName: v.companyName,
            contactName: v.companyName,
            contactKind: ListContactKind.VENDOR,
            niche: v.niches[0]?.niche.label ?? '',
            country: v.countries.map((c) => c.country.code).filter(Boolean).join(', '),
            traffic: v.traffic,
            dr: v.dr,
            da: v.mozDa,
            authorityScore: v.authorityScore,
            backlinks: v.backlinks,
            referringDomains: v.referringDomains,
            emails: [v.contactEmail] as unknown as Prisma.InputJsonValue,
          },
        });
        updated++;
        continue;
      }
      const c = await this.prisma.client.findFirst({
        where: { userId, siteUrlNormalized: it.siteUrlNormalized, deletedAt: null },
        include: { niches: { include: { niche: true } }, countries: { include: { country: true } } },
      });
      if (c) {
        await this.prisma.emailListItem.update({
          where: { id: it.id },
          data: {
            companyName: c.companyName,
            contactName: c.clientName,
            contactKind: ListContactKind.CLIENT,
            niche: c.niches[0]?.niche.label ?? '',
            country: c.countries.map((x) => x.country.code).filter(Boolean).join(', '),
            traffic: c.traffic,
            dr: c.dr,
            da: c.mozDa,
            authorityScore: c.authorityScore,
            backlinks: c.backlinks,
            referringDomains: c.referringDomains,
            emails: [c.email] as unknown as Prisma.InputJsonValue,
          },
        });
        updated++;
      }
    }
    await this.prisma.emailList.update({
      where: { id: listId },
      data: { lastAutoUpdateAt: new Date() },
    });
    return { updated, total: items.length };
  }
}
