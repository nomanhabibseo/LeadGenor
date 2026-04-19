import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reference')
@UseGuards(JwtAuthGuard)
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all() {
    const [currencies, niches, countries, languages, paymentMethods, afterLiveOptions] =
      await Promise.all([
        this.prisma.currency.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.niche.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.country.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.language.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.paymentMethod.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.paymentTermAfterLiveOption.findMany({ orderBy: { sortOrder: 'asc' } }),
      ]);
    return {
      currencies,
      niches,
      countries,
      languages,
      paymentMethods,
      afterLiveOptions,
      deliveryDayOptions: Array.from({ length: 30 }, (_, i) => i + 1),
    };
  }
}
