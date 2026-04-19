import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DealStatus, PaymentTerms } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { VendorBodyDto } from './dto/vendor-body.dto';
import { VendorsService, VendorListScope } from './vendors.service';

class ListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 20;

  @IsOptional()
  @IsString()
  searchUrl?: string;

  @IsOptional()
  @IsEnum(DealStatus)
  dealStatus?: DealStatus;

  @IsOptional()
  @Type(() => Number)
  drMin?: number;

  @IsOptional()
  @Type(() => Number)
  drMax?: number;

  @IsOptional()
  @Type(() => Number)
  trafficMin?: number;

  @IsOptional()
  @Type(() => Number)
  trafficMax?: number;

  @IsOptional()
  @Type(() => Number)
  refMin?: number;

  @IsOptional()
  @Type(() => Number)
  refMax?: number;

  @IsOptional()
  @Type(() => Number)
  gpPriceMin?: number;

  @IsOptional()
  @Type(() => Number)
  gpPriceMax?: number;

  @IsOptional()
  @Type(() => Number)
  nePriceMin?: number;

  @IsOptional()
  @Type(() => Number)
  nePriceMax?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  nicheIds?: string;

  @IsOptional()
  @IsString()
  countryIds?: string;

  @IsOptional()
  @IsIn(['include', 'exclude'])
  nicheMode?: 'include' | 'exclude';

  @IsOptional()
  @IsIn(['include', 'exclude'])
  countryMode?: 'include' | 'exclude';

  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @IsOptional()
  @Type(() => Number)
  mozDaMin?: number;

  @IsOptional()
  @Type(() => Number)
  mozDaMax?: number;

  @IsOptional()
  @Type(() => Number)
  authorityScoreMin?: number;

  @IsOptional()
  @Type(() => Number)
  authorityScoreMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tatValueMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tatValueMax?: number;

  @IsOptional()
  @Type(() => Number)
  backlinksMin?: number;

  @IsOptional()
  @Type(() => Number)
  backlinksMax?: number;
}

class BulkPriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  percent!: number;

  @Type(() => Boolean)
  @IsBoolean()
  guestPost = true;

  @Type(() => Boolean)
  @IsBoolean()
  nicheEdit = true;
}

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get('check-url')
  async checkUrl(@CurrentUser() user: JwtUser, @Query('url') url: string) {
    const { normalizeSiteUrl } = await import('@leadgenor/shared');
    const normalized = normalizeSiteUrl(url || '');
    const existing = await this.vendors.assertNoDuplicate(user.userId, normalized);
    return { exists: !!existing, duplicate: existing };
  }

  @Get()
  async list(
    @CurrentUser() user: JwtUser,
    @Query('scope') scope: VendorListScope = 'all',
    @Query() q: ListQuery,
  ) {
    const nicheIds = q.nicheIds?.split(',').filter(Boolean);
    const countryIds = q.countryIds?.split(',').filter(Boolean);
    return this.vendors.list(user.userId, scope, {
      page: q.page,
      limit: q.limit,
      searchUrl: q.searchUrl,
      dealStatus: q.dealStatus,
      drMin: q.drMin,
      drMax: q.drMax,
      trafficMin: q.trafficMin,
      trafficMax: q.trafficMax,
      refMin: q.refMin,
      refMax: q.refMax,
      gpPriceMin: q.gpPriceMin,
      gpPriceMax: q.gpPriceMax,
      nePriceMin: q.nePriceMin,
      nePriceMax: q.nePriceMax,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      nicheIds,
      nicheMode: q.nicheMode,
      countryIds,
      countryMode: q.countryMode,
      languageId: q.languageId,
      paymentTerms: q.paymentTerms,
      mozDaMin: q.mozDaMin,
      mozDaMax: q.mozDaMax,
      authorityScoreMin: q.authorityScoreMin,
      authorityScoreMax: q.authorityScoreMax,
      tatValueMin: q.tatValueMin,
      tatValueMax: q.tatValueMax,
      backlinksMin: q.backlinksMin,
      backlinksMax: q.backlinksMax,
    });
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: VendorBodyDto) {
    return this.vendors.create(user.userId, body);
  }

  @Post('force')
  createForce(@CurrentUser() user: JwtUser, @Body() body: VendorBodyDto) {
    return this.vendors.createAnyway(user.userId, body);
  }

  @Post('bulk-price')
  bulkPrice(@CurrentUser() user: JwtUser, @Body() body: BulkPriceDto) {
    return this.vendors.bulkPriceAdjustDealDone(user.userId, body.percent, body.guestPost, body.nicheEdit);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vendors.findOne(user.userId, id);
  }

  @Put(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: VendorBodyDto) {
    return this.vendors.update(user.userId, id, body);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vendors.softDelete(user.userId, id);
  }

  @Post(':id/restore-quick')
  restoreQuick(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vendors.restoreQuick(user.userId, id);
  }

  @Post(':id/restore')
  restoreFromTrash(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vendors.restoreFromTrash(user.userId, id);
  }

  @Delete(':id/permanent')
  permanentDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vendors.permanentDelete(user.userId, id);
  }
}
