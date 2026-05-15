import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** usdPerUnit: 1 unit of currency = usdPerUnit USD */
@Injectable()
export class FxService {
  private readonly log = new Logger(FxService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async nightlyRefresh() {
    try {
      await this.refreshFromFrankfurter();
      this.log.log('FX rates refreshed');
    } catch (e) {
      this.log.warn(`FX refresh failed: ${e}`);
    }
  }

  async getUsdPerUnit(currencyId: string, on: Date): Promise<Prisma.Decimal> {
    const day = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()));
    const row = await this.prisma.exchangeRate.findUnique({
      where: { currencyId_date: { currencyId, date: day } },
    });
    if (row) return row.usdPerUnit;
    const latest = await this.prisma.exchangeRate.findFirst({
      where: { currencyId },
      orderBy: { date: 'desc' },
    });
    if (latest) return latest.usdPerUnit;
    const cur = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (cur?.code === 'USD') return new Prisma.Decimal(1);
    return new Prisma.Decimal(1);
  }

  /** Convert amount in given currency to USD */
  async toUsd(amount: Prisma.Decimal, currencyId: string, on: Date): Promise<Prisma.Decimal> {
    const usdPerUnit = await this.getUsdPerUnit(currencyId, on);
    return amount.mul(usdPerUnit);
  }

  /** Convert USD amount to target currency units */
  async convertUsdToCurrency(usdAmount: Prisma.Decimal, targetCurrencyId: string, on: Date): Promise<Prisma.Decimal> {
    const usdPerUnit = await this.getUsdPerUnit(targetCurrencyId, on);
    if (usdPerUnit.equals(0)) return new Prisma.Decimal(0);
    return usdAmount.div(usdPerUnit);
  }

  async refreshFromFrankfurter() {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!res.ok) throw new Error('FX fetch failed');
    const data = (await res.json()) as { rates: Record<string, number> };
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);

    const usd = await this.prisma.currency.findUnique({ where: { code: 'USD' } });
    if (usd) {
      await this.prisma.exchangeRate.upsert({
        where: { currencyId_date: { currencyId: usd.id, date: day } },
        update: { usdPerUnit: 1 },
        create: { currencyId: usd.id, date: day, usdPerUnit: 1 },
      });
    }

    const currencies = await this.prisma.currency.findMany();
    for (const c of currencies) {
      if (c.code === 'USD') continue;
      const rateFromUsd = data.rates[c.code];
      if (rateFromUsd == null) continue;
      const usdPerUnit = new Prisma.Decimal(1).div(rateFromUsd);
      await this.prisma.exchangeRate.upsert({
        where: { currencyId_date: { currencyId: c.id, date: day } },
        update: { usdPerUnit },
        create: { currencyId: c.id, date: day, usdPerUnit },
      });
    }
    return { ok: true, date: day };
  }
}
