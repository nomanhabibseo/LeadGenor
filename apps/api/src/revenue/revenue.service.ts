import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';

@Injectable()
export class RevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async dashboardStats(userId: string) {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const completed = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.COMPLETED, deletedAt: null },
      include: { currency: true },
    });

    let totalSaleUsd = 0;
    let totalProfitUsd = 0;
    let last30SaleUsd = 0;
    let last30ProfitUsd = 0;
    let lastMonthSaleUsd = 0;
    let lastMonthProfitUsd = 0;

    for (const o of completed) {
      const saleUsd = await this.fx.toUsd(o.totalPayment, o.currencyId, o.orderDate);
      const profit = o.resellerPrice.sub(o.vendorCost);
      const profitUsd = await this.fx.toUsd(profit, o.currencyId, o.orderDate);

      totalSaleUsd += Number(saleUsd);
      totalProfitUsd += Number(profitUsd);

      if (o.orderDate >= d30) {
        last30SaleUsd += Number(saleUsd);
        last30ProfitUsd += Number(profitUsd);
      }
      if (o.orderDate >= monthStart) {
        lastMonthSaleUsd += Number(saleUsd);
        lastMonthProfitUsd += Number(profitUsd);
      }
    }

    const [totalVendors, dealDone, pendingDeals, totalClients, completedOrders, pendingOrders] =
      await Promise.all([
        this.prisma.vendor.count({ where: { userId, deletedAt: null } }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null, dealStatus: 'DEAL_DONE' } }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null, dealStatus: 'PENDING' } }),
        this.prisma.client.count({ where: { userId, deletedAt: null } }),
        this.prisma.order.count({ where: { userId, deletedAt: null, status: OrderStatus.COMPLETED } }),
        this.prisma.order.count({ where: { userId, deletedAt: null, status: OrderStatus.PENDING } }),
      ]);

    return {
      totalSaleUsd,
      last30DaysSaleUsd: last30SaleUsd,
      totalProfitUsd,
      last30DaysProfitUsd: last30ProfitUsd,
      lastMonthSaleUsd,
      lastMonthProfitUsd,
      totalVendors,
      dealDoneVendors: dealDone,
      pendingDeals: pendingDeals,
      totalClients,
      completedOrders,
      pendingOrders,
    };
  }

  async revenueOrders(userId: string, scope: 'total' | 'last_month', page: number, limit: number) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const where = {
      userId,
      status: OrderStatus.COMPLETED,
      deletedAt: null,
      ...(scope === 'last_month' ? { orderDate: { gte: monthStart } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { client: true, vendor: true, currency: true },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = [];
    for (const o of rows) {
      const saleUsd = await this.fx.toUsd(o.totalPayment, o.currencyId, o.orderDate);
      const profit = o.resellerPrice.sub(o.vendorCost);
      const profitUsd = await this.fx.toUsd(profit, o.currencyId, o.orderDate);
      data.push({
        order: o,
        saleUsd: saleUsd.toString(),
        profitUsd: profitUsd.toString(),
      });
    }

    return { data, total, page, limit };
  }
}
