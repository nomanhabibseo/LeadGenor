import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkType, OrderStatus, Prisma, SeoLinkAttribute } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { joinEmails, parseEmails } from '../common/multi-email';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import { OrderBodyDto } from './dto/order-body.dto';

function toDec(n: number) {
  return new Prisma.Decimal(n);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  private priceFromVendor(linkType: LinkType, vendor: { guestPostPrice: Prisma.Decimal; nicheEditPrice: Prisma.Decimal }) {
    return linkType === LinkType.GUEST_POST ? vendor.guestPostPrice : vendor.nicheEditPrice;
  }

  private costFromVendor(linkType: LinkType, vendor: { guestPostCost: Prisma.Decimal; nicheEditCost: Prisma.Decimal }) {
    return linkType === LinkType.GUEST_POST ? vendor.guestPostCost : vendor.nicheEditCost;
  }

  async create(userId: string, dto: OrderBodyDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, userId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    const resellerPrice = this.priceFromVendor(dto.linkType, vendor);
    const vendorCost = this.costFromVendor(dto.linkType, vendor);

    let articleUsd = toDec(0);
    if (dto.articleWriting) {
      if (dto.articleWritingFeeUsd == null) throw new BadRequestException('Article writing fee required');
      articleUsd = toDec(dto.articleWritingFeeUsd);
    }

    const orderCurrencyId = vendor.currencyId;
    const articleInOrderCurrency = await this.fx.convertUsdToCurrency(articleUsd, orderCurrencyId, new Date(dto.orderDate));

    const totalPayment = resellerPrice.add(articleInOrderCurrency);

    const fromDto = parseEmails(dto.clientEmail ?? '');
    const fromClient = parseEmails(client.email);
    const emails = fromDto.length ? fromDto : fromClient;
    if (!emails.length) throw new BadRequestException('At least one valid client email is required.');
    const email = joinEmails(emails);

    const seoAttr = dto.seoLinkAttribute ?? SeoLinkAttribute.DO_FOLLOW;
    const seoQty = dto.seoLinkQuantity != null && dto.seoLinkQuantity > 0 ? dto.seoLinkQuantity : 1;

    return this.prisma.order.create({
      data: {
        userId,
        clientId: dto.clientId,
        vendorId: dto.vendorId,
        linkType: dto.linkType,
        seoLinkAttribute: seoAttr,
        seoLinkQuantity: seoQty,
        resellerPrice,
        vendorCost,
        articleWriting: dto.articleWriting,
        articleWritingFeeUsd: dto.articleWriting ? articleUsd : null,
        totalPayment,
        paymentTerms: dto.paymentTerms,
        deliveryDays: dto.deliveryDays,
        status: dto.status,
        orderDate: new Date(dto.orderDate),
        clientEmail: email,
        currencyId: orderCurrencyId,
        paymentMethodNote: dto.paymentMethodNote ?? null,
      },
      include: {
        client: true,
        vendor: { include: { currency: true } },
        currency: true,
      },
    });
  }

  async update(userId: string, id: string, dto: OrderBodyDto) {
    const existing = await this.prisma.order.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException();

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, userId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    const resellerPrice = this.priceFromVendor(dto.linkType, vendor);
    const vendorCost = this.costFromVendor(dto.linkType, vendor);

    let articleUsd = toDec(0);
    if (dto.articleWriting) {
      if (dto.articleWritingFeeUsd == null) throw new BadRequestException('Article writing fee required');
      articleUsd = toDec(dto.articleWritingFeeUsd);
    }

    const orderCurrencyId = vendor.currencyId;
    const articleInOrderCurrency = await this.fx.convertUsdToCurrency(articleUsd, orderCurrencyId, new Date(dto.orderDate));
    const totalPayment = resellerPrice.add(articleInOrderCurrency);
    const fromDto = parseEmails(dto.clientEmail ?? '');
    const fromClient = parseEmails(client.email);
    const emails = fromDto.length ? fromDto : fromClient;
    if (!emails.length) throw new BadRequestException('At least one valid client email is required.');
    const email = joinEmails(emails);

    const seoAttr = dto.seoLinkAttribute ?? SeoLinkAttribute.DO_FOLLOW;
    const seoQty = dto.seoLinkQuantity != null && dto.seoLinkQuantity > 0 ? dto.seoLinkQuantity : 1;

    return this.prisma.order.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        vendorId: dto.vendorId,
        linkType: dto.linkType,
        seoLinkAttribute: seoAttr,
        seoLinkQuantity: seoQty,
        resellerPrice,
        vendorCost,
        articleWriting: dto.articleWriting,
        articleWritingFeeUsd: dto.articleWriting ? articleUsd : null,
        totalPayment,
        paymentTerms: dto.paymentTerms,
        deliveryDays: dto.deliveryDays,
        status: dto.status,
        orderDate: new Date(dto.orderDate),
        clientEmail: email,
        currencyId: orderCurrencyId,
        paymentMethodNote: dto.paymentMethodNote ?? null,
      },
      include: {
        client: true,
        vendor: { include: { currency: true } },
        currency: true,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        client: true,
        vendor: { include: { currency: true } },
        currency: true,
      },
    });
    if (!o) throw new NotFoundException();
    return o;
  }

  private buildOrderListWhere(
    userId: string,
    scope: 'all' | 'completed' | 'pending' | 'trash',
    q: { dateFrom?: string; dateTo?: string; searchUrl?: string },
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { userId };
    if (scope === 'trash') where.deletedAt = { not: null };
    else {
      where.deletedAt = null;
      if (scope === 'completed') where.status = OrderStatus.COMPLETED;
      if (scope === 'pending') where.status = OrderStatus.PENDING;
    }

    if (q.dateFrom || q.dateTo) {
      where.orderDate = {};
      if (q.dateFrom) where.orderDate.gte = new Date(q.dateFrom);
      if (q.dateTo) {
        const end = new Date(q.dateTo);
        end.setHours(23, 59, 59, 999);
        where.orderDate.lte = end;
      }
    }
    if (q.searchUrl?.trim()) {
      const needle = normalizeSiteUrl(q.searchUrl).replace(/^https?:\/\//i, '');
      const searchClause: Prisma.OrderWhereInput = {
        OR: [
          { vendor: { siteUrlNormalized: { contains: needle, mode: 'insensitive' } } },
          { client: { siteUrlNormalized: { contains: needle, mode: 'insensitive' } } },
        ],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), searchClause];
    }
    return where;
  }

  async listIds(
    userId: string,
    scope: 'all' | 'completed' | 'pending' | 'trash',
    q: { dateFrom?: string; dateTo?: string; searchUrl?: string },
  ) {
    const where = this.buildOrderListWhere(userId, scope, q);
    const total = await this.prisma.order.count({ where });
    const MAX_IDS = 5000;
    const rows = await this.prisma.order.findMany({
      where,
      select: { id: true },
      orderBy: { orderDate: 'desc' },
      take: Math.min(total, MAX_IDS),
    });
    return {
      ids: rows.map((r) => r.id),
      total,
      truncated: total > MAX_IDS,
    };
  }

  async list(
    userId: string,
    scope: 'all' | 'completed' | 'pending' | 'trash',
    q: { page: number; limit: number; dateFrom?: string; dateTo?: string; searchUrl?: string },
  ) {
    const where = this.buildOrderListWhere(userId, scope, q);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          client: true,
          vendor: { include: { currency: true } },
          currency: true,
        },
        orderBy: { orderDate: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    return { data, total, page: q.page, limit: q.limit };
  }

  /** Same filters as list; optional id subset; capped rows for export. */
  async exportRows(
    userId: string,
    scope: 'all' | 'completed' | 'pending' | 'trash',
    filters: { dateFrom?: string; dateTo?: string; searchUrl?: string },
    opts: { ids?: string[]; limit: number; offset?: number },
  ) {
    const where = this.buildOrderListWhere(userId, scope, filters);
    if (opts.ids?.length) {
      where.id = { in: opts.ids };
    }
    return this.prisma.order.findMany({
      where,
      include: {
        client: true,
        vendor: { include: { currency: true } },
        currency: true,
      },
      orderBy: { orderDate: 'desc' },
      skip: opts.offset ?? 0,
      take: opts.limit,
    });
  }

  async softDelete(userId: string, id: string) {
    return this.prisma.order.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async softDeleteMany(userId: string, ids: string[]) {
    const uniq = [...new Set(ids)].filter(Boolean);
    if (!uniq.length) return { deleted: 0 };
    const res = await this.prisma.order.updateMany({
      where: { userId, id: { in: uniq }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deleted: res.count };
  }

  async restoreQuick(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!o?.deletedAt) throw new NotFoundException();
    if (Date.now() - o.deletedAt.getTime() > 5000) throw new BadRequestException('Undo window expired');
    return this.prisma.order.update({ where: { id }, data: { deletedAt: null } });
  }

  async restoreFromTrash(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId, deletedAt: { not: null } } });
    if (!o) throw new NotFoundException();
    return this.prisma.order.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(userId: string, id: string) {
    await this.prisma.order.delete({ where: { id, userId } });
    return { ok: true };
  }

  async permanentDeleteMany(userId: string, ids: string[]) {
    const uniq = [...new Set(ids)].filter(Boolean);
    if (!uniq.length) return { deleted: 0 };
    const res = await this.prisma.order.deleteMany({
      where: { userId, id: { in: uniq }, deletedAt: { not: null } },
    });
    return { deleted: res.count };
  }

  async previewPrice(
    userId: string,
    vendorId: string,
    linkType: LinkType,
    opts?: { orderDate?: string; articleWritingFeeUsd?: number },
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, userId, deletedAt: null },
      include: { currency: true },
    });
    if (!vendor) throw new NotFoundException();
    const resellerPrice = this.priceFromVendor(linkType, vendor);
    const orderCurrencyId = vendor.currencyId;
    const orderDate = opts?.orderDate ? new Date(opts.orderDate) : new Date();
    let articleInOrderCurrency = toDec(0);
    const feeUsd = opts?.articleWritingFeeUsd;
    if (feeUsd != null && feeUsd > 0) {
      articleInOrderCurrency = await this.fx.convertUsdToCurrency(toDec(feeUsd), orderCurrencyId, orderDate);
    }
    const totalPayment = resellerPrice.add(articleInOrderCurrency);
    return {
      resellerPrice: resellerPrice.toString(),
      articleInOrderCurrency: articleInOrderCurrency.toString(),
      totalPayment: totalPayment.toString(),
      currency: vendor.currency,
      linkType,
    };
  }
}
