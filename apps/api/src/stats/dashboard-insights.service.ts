import { Injectable } from '@nestjs/common';
import {
  CampaignStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import {
  downsample,
  everyDayInRange,
  everyHourInRange,
  getTimeWindow,
  parseTimeRange,
  type TimeRangeKey,
} from './dashboard-time-range';

export type RangeQuery = {
  leads: TimeRangeKey;
  delivery: TimeRangeKey;
  response: TimeRangeKey;
  revenue: TimeRangeKey;
  profit: TimeRangeKey;
};

type DayAgg = { day: string; sent: number; failed: number; replied: number };
type HourAgg = { hsec: bigint; sent: number; failed: number; replied: number };

@Injectable()
export class DashboardInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async getInsights(
    userId: string,
    q: {
      leads?: string;
      delivery?: string;
      response?: string;
      revenue?: string;
      profit?: string;
    },
  ) {
    const ranges: RangeQuery = {
      leads: parseTimeRange(q.leads),
      delivery: parseTimeRange(q.delivery),
      response: parseTimeRange(q.response),
      revenue: parseTimeRange(q.revenue),
      profit: parseTimeRange(q.profit),
    };

    const lifeFrom = await this.resolveLifeFrom(userId);

    const [snapshot, leads, delivery, response, revenue, profit] = await Promise.all([
      this.getSnapshotInternal(userId),
      this.metricLeads(userId, ranges.leads, lifeFrom),
      this.metricDelivery(userId, ranges.delivery, lifeFrom),
      this.metricResponse(userId, ranges.response, lifeFrom),
      this.metricRevenue(userId, ranges.revenue, lifeFrom),
      this.metricProfit(userId, ranges.profit, lifeFrom),
    ]);

    return { snapshot, leads, delivery, response, revenue, profit };
  }

  // Exposed for lightweight dashboard refreshes.
  async getSnapshot(userId: string) {
    return this.getSnapshotInternal(userId);
  }

  async getMetric(userId: string, k?: string, range?: string) {
    const key = (k ?? '').trim();
    const r = parseTimeRange(range);
    const lifeFrom = await this.resolveLifeFrom(userId);
    if (key === 'leads') return this.metricLeads(userId, r, lifeFrom);
    if (key === 'delivery') return this.metricDelivery(userId, r, lifeFrom);
    if (key === 'response') return this.metricResponse(userId, r, lifeFrom);
    if (key === 'revenue') return this.metricRevenue(userId, r, lifeFrom);
    if (key === 'profit') return this.metricProfit(userId, r, lifeFrom);
    return { error: 'Unknown metric key' };
  }

  async getHighlight(userId: string, kind?: string) {
    const k = (kind ?? '').trim();
    const last7 = new Date();
    last7.setDate(last7.getDate() - 7);

    if (k === 'orders') {
      const rows = await this.prisma.order.findMany({
        where: { userId, deletedAt: null, status: OrderStatus.COMPLETED, orderDate: { gte: last7 } },
        orderBy: { orderDate: 'desc' },
        take: 10,
        select: {
          id: true,
          orderDate: true,
          status: true,
          linkType: true,
          totalPayment: true,
          currency: { select: { code: true, symbol: true } },
          client: { select: { siteUrl: true } },
          vendor: { select: { siteUrl: true } },
        },
      });
      return { kind: 'orders', rows };
    }

    if (k === 'clients') {
      const rows = await this.prisma.client.findMany({
        where: { userId, deletedAt: null, createdAt: { gte: last7 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          siteUrl: true,
          dr: true,
          traffic: true,
          language: { select: { name: true } },
          niches: { select: { niche: { select: { label: true } } } },
          countries: { select: { country: { select: { name: true, code: true } } } },
        },
      });
      return { kind: 'clients', rows };
    }

    if (k === 'vendors') {
      const top = await this.prisma.order.groupBy({
        by: ['vendorId'],
        where: { userId, deletedAt: null, status: OrderStatus.COMPLETED },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });
      const vendorIds = top.map((t) => t.vendorId).filter(Boolean) as string[];
      const vendors = await this.prisma.vendor.findMany({
        where: { userId, deletedAt: null, id: { in: vendorIds } },
        select: { id: true, siteUrl: true },
      });
      const m = new Map(vendors.map((v) => [v.id, v.siteUrl] as const));
      const rows = top.map((t) => ({
        vendorId: t.vendorId,
        siteUrl: m.get(t.vendorId) ?? '',
        completedOrders: (t as unknown as { _count: { id: number } })._count.id,
      }));
      return { kind: 'vendors', rows };
    }

    return { kind: 'orders', rows: [] };
  }

  private async resolveLifeFrom(userId: string): Promise<Date> {
    const [minO, minC, minSend] = await Promise.all([
      this.prisma.order.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { orderDate: 'asc' },
        select: { orderDate: true },
      }),
      this.prisma.campaign.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.$queryRaw<{ d: Date }[]>(Prisma.sql`
        SELECT min(cr."lastSentAt") as d
        FROM "CampaignRecipient" cr
        INNER JOIN "Campaign" c ON c."id" = cr."campaignId" AND c."userId" = ${userId} AND c."deletedAt" IS NULL
        WHERE cr."lastSentAt" IS NOT NULL
      `),
    ]);
    const candidates: Date[] = [];
    if (minO) candidates.push(minO.orderDate);
    if (minC) candidates.push(minC.createdAt);
    if (minSend[0]?.d) candidates.push(new Date(minSend[0].d));
    if (candidates.length === 0) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 2);
      return d;
    }
    return new Date(Math.min(...candidates.map((c) => c.getTime())));
  }

  private async getSnapshotInternal(userId: string) {
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    const [
      byStatus,
      totalVendors,
      dealDone,
      pendingDeals,
      totalClients,
      totalOrders,
      completedOrders,
      pendingOrders,
      vendorsLast30,
      clientsLast30,
      ordersLast30,
    ] = await Promise.all([
        this.prisma.campaign.groupBy({
          by: ['status'],
          where: { userId, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null } }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null, dealStatus: 'DEAL_DONE' } }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null, dealStatus: 'PENDING' } }),
        this.prisma.client.count({ where: { userId, deletedAt: null } }),
        this.prisma.order.count({ where: { userId, deletedAt: null } }),
        this.prisma.order.count({ where: { userId, deletedAt: null, status: OrderStatus.COMPLETED } }),
        this.prisma.order.count({ where: { userId, deletedAt: null, status: OrderStatus.PENDING } }),
        this.prisma.vendor.count({ where: { userId, deletedAt: null, createdAt: { gte: last30 } } }),
        this.prisma.client.count({ where: { userId, deletedAt: null, createdAt: { gte: last30 } } }),
        this.prisma.order.count({ where: { userId, deletedAt: null, orderDate: { gte: last30 } } }),
      ]);

    const statusCount = (s: CampaignStatus) =>
      byStatus.find((r) => r.status === s)?._count._all ?? 0;

    return {
      runningCampaigns: statusCount(CampaignStatus.RUNNING),
      completedCampaigns: statusCount(CampaignStatus.COMPLETED),
      scheduledCampaigns: statusCount(CampaignStatus.SCHEDULED),
      totalVendors,
      dealDoneVendors: dealDone,
      pendingDeals,
      vendorsLast30,
      totalClients,
      clientsLast30,
      totalOrders,
      completedOrders,
      pendingOrders,
      ordersLast30,
    };
  }

  private async metricLeads(userId: string, key: TimeRangeKey, lifeFrom: Date) {
    const { from, to, bucket } = getTimeWindow(key, lifeFrom);
    if (bucket === 'hour') {
      const rows = await this.recipientHourAgg(userId, from, to);
      const keys = everyHourKeySec(from, to);
      const m = new Map<number, { sent: number; failed: number; replied: number }>();
      for (const r of rows) m.set(Number(r.hsec), { sent: r.sent, failed: r.failed, replied: r.replied });
      const series = downsample(
        keys.map((sec) => ({ t: new Date(sec * 1000).toISOString(), v: m.get(sec)?.sent ?? 0 })),
        32,
      );
      const total = rows.reduce((a, b) => a + b.sent, 0);
      return { range: key, from, to, total, series, unit: 'count' as const };
    }
    const rows = await this.recipientDayAgg(userId, from, to);
    const m = new Map<string, { sent: number; failed: number; replied: number }>();
    for (const r of rows) m.set(r.day, { sent: r.sent, failed: r.failed, replied: r.replied });
    const days = everyDayInRange(from, to);
    const allPoints = days.map((t) => ({ t, v: m.get(t)?.sent ?? 0 }));
    const total = rows.reduce((a, b) => a + b.sent, 0);
    return {
      range: key,
      from,
      to,
      total,
      series: downsample(allPoints, 64),
      unit: 'count' as const,
    };
  }

  private async metricDelivery(userId: string, key: TimeRangeKey, lifeFrom: Date) {
    const { from, to, bucket } = getTimeWindow(key, lifeFrom);
    if (bucket === 'hour') {
      const rows = await this.recipientHourAgg(userId, from, to);
      const keys = everyHourKeySec(from, to);
      const m = new Map<number, DayAgg>();
      for (const r of rows) {
        m.set(Number(r.hsec), {
          day: String(r.hsec),
          sent: r.sent,
          failed: r.failed,
          replied: r.replied,
        });
      }
      let totSent = 0;
      let totFail = 0;
      for (const r of rows) {
        totSent += r.sent;
        totFail += r.failed;
      }
      const pct = totSent > 0 ? (100 * (totSent - totFail)) / totSent : 0;
      const series = downsample(
        keys.map((sec) => {
          const s = m.get(sec);
          const v = s && s.sent > 0 ? (100 * (s.sent - s.failed)) / s.sent : 0;
          return { t: new Date(sec * 1000).toISOString(), v };
        }),
        32,
      );
      return { range: key, from, to, pct, series, unit: 'pct' as const };
    }
    const rows = await this.recipientDayAgg(userId, from, to);
    const m = new Map<string, DayAgg>();
    for (const r of rows) m.set(r.day, r);
    const days = everyDayInRange(from, to);
    let totSent = 0;
    let totFail = 0;
    for (const r of rows) {
      totSent += r.sent;
      totFail += r.failed;
    }
    const pct = totSent > 0 ? (100 * (totSent - totFail)) / totSent : 0;
    const allPoints = days.map((t) => {
      const s = m.get(t);
      const v = s && s.sent > 0 ? (100 * (s.sent - s.failed)) / s.sent : 0;
      return { t, v };
    });
    return {
      range: key,
      from,
      to,
      pct,
      series: downsample(allPoints, 64),
      unit: 'pct' as const,
    };
  }

  private async metricResponse(userId: string, key: TimeRangeKey, lifeFrom: Date) {
    const { from, to, bucket } = getTimeWindow(key, lifeFrom);
    if (bucket === 'hour') {
      const rows = await this.recipientHourAgg(userId, from, to);
      const keys = everyHourKeySec(from, to);
      const m = new Map<number, DayAgg>();
      for (const r of rows) {
        m.set(Number(r.hsec), {
          day: String(r.hsec),
          sent: r.sent,
          failed: r.failed,
          replied: r.replied,
        });
      }
      let totSent = 0;
      let totReplied = 0;
      for (const r of rows) {
        totSent += r.sent;
        totReplied += r.replied;
      }
      const pct = totSent > 0 ? (100 * totReplied) / totSent : 0;
      const series = downsample(
        keys.map((sec) => {
          const s = m.get(sec);
          const v = s && s.sent > 0 ? (100 * s.replied) / s.sent : 0;
          return { t: new Date(sec * 1000).toISOString(), v };
        }),
        32,
      );
      return { range: key, from, to, pct, series, unit: 'pct' as const };
    }
    const rows = await this.recipientDayAgg(userId, from, to);
    const m = new Map<string, DayAgg>();
    for (const r of rows) m.set(r.day, r);
    const days = everyDayInRange(from, to);
    let totSent = 0;
    let totReplied = 0;
    for (const r of rows) {
      totSent += r.sent;
      totReplied += r.replied;
    }
    const pct = totSent > 0 ? (100 * totReplied) / totSent : 0;
    const allPoints = days.map((t) => {
      const s = m.get(t);
      const v = s && s.sent > 0 ? (100 * s.replied) / s.sent : 0;
      return { t, v };
    });
    return {
      range: key,
      from,
      to,
      pct,
      series: downsample(allPoints, 64),
      unit: 'pct' as const,
    };
  }

  private async metricRevenue(userId: string, key: TimeRangeKey, lifeFrom: Date) {
    const { from, to } = getTimeWindow(key, lifeFrom);
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.COMPLETED, deletedAt: null, orderDate: { gte: from, lte: to } },
      include: { currency: true },
    });
    const byDay = new Map<string, number>();
    let usd = 0;
    for (const o of orders) {
      const sale = await this.fx.toUsd(o.totalPayment, o.currencyId, o.orderDate);
      const n = Number(sale);
      usd += n;
      const day = o.orderDate.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + n);
    }
    const days = everyDayInRange(from, to);
    const allPoints = days.map((t) => ({ t, v: byDay.get(t) ?? 0 }));
    return {
      range: key,
      from,
      to,
      usd,
      series: downsample(allPoints, 64),
      unit: 'usd' as const,
    };
  }

  private async metricProfit(userId: string, key: TimeRangeKey, lifeFrom: Date) {
    const { from, to } = getTimeWindow(key, lifeFrom);
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.COMPLETED, deletedAt: null, orderDate: { gte: from, lte: to } },
      include: { currency: true },
    });
    const byDay = new Map<string, number>();
    let profitUsd = 0;
    let saleUsd = 0;
    for (const o of orders) {
      const s = await this.fx.toUsd(o.totalPayment, o.currencyId, o.orderDate);
      const profit = o.resellerPrice.sub(o.vendorCost);
      const p = await this.fx.toUsd(profit, o.currencyId, o.orderDate);
      const sn = Number(s);
      const pn = Number(p);
      saleUsd += sn;
      profitUsd += pn;
      const day = o.orderDate.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + pn);
    }
    const days = everyDayInRange(from, to);
    const allPoints = days.map((t) => ({ t, v: byDay.get(t) ?? 0 }));
    const marginPct = saleUsd > 0 ? (100 * profitUsd) / saleUsd : 0;
    return {
      range: key,
      from,
      to,
      usd: profitUsd,
      marginPct,
      series: downsample(allPoints, 64),
      unit: 'usd' as const,
    };
  }

  private async recipientDayAgg(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<DayAgg[]> {
    return this.prisma.$queryRaw<DayAgg[]>(Prisma.sql`
      SELECT
        to_char((cr."lastSentAt" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') as day,
        count(*)::int as sent,
        count(*) FILTER (WHERE cr."status" = 'FAILED')::int as failed,
        count(*) FILTER (WHERE cr."replied" = true)::int as replied
      FROM "CampaignRecipient" cr
      INNER JOIN "Campaign" c ON c."id" = cr."campaignId" AND c."userId" = ${userId} AND c."deletedAt" IS NULL
      WHERE cr."lastSentAt" IS NOT NULL
        AND cr."lastSentAt" >= ${from}
        AND cr."lastSentAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `);
  }

  private async recipientHourAgg(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<HourAgg[]> {
    return this.prisma.$queryRaw<HourAgg[]>(Prisma.sql`
      SELECT
        (floor(extract(epoch from cr."lastSentAt") / 3600) * 3600)::bigint as hsec,
        count(*)::int as sent,
        count(*) FILTER (WHERE cr."status" = 'FAILED')::int as failed,
        count(*) FILTER (WHERE cr."replied" = true)::int as replied
      FROM "CampaignRecipient" cr
      INNER JOIN "Campaign" c ON c."id" = cr."campaignId" AND c."userId" = ${userId} AND c."deletedAt" IS NULL
      WHERE cr."lastSentAt" IS NOT NULL
        AND cr."lastSentAt" >= ${from}
        AND cr."lastSentAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `);
  }
}

function everyHourKeySec(from: Date, to: Date): number[] {
  const startMs = Math.floor(from.getTime() / 3600000) * 3600000;
  const endMs = Math.floor(to.getTime() / 3600000) * 3600000;
  const out: number[] = [];
  for (let ms = startMs; ms <= endMs; ms += 3600000) {
    out.push(Math.floor(ms / 1000));
  }
  return out;
}
