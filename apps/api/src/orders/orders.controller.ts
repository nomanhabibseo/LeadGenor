import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { LinkType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { OrderBodyDto } from './dto/order-body.dto';
import { OrdersService } from './orders.service';

class OrderListQuery {
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
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  searchUrl?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('preview-price')
  preview(
    @CurrentUser() user: JwtUser,
    @Query('vendorId') vendorId: string,
    @Query('linkType') linkType: LinkType,
    @Query('orderDate') orderDate?: string,
    @Query('articleWritingFeeUsd') articleWritingFeeUsd?: string,
  ) {
    const fee =
      articleWritingFeeUsd != null && articleWritingFeeUsd !== ''
        ? Number(articleWritingFeeUsd)
        : undefined;
    return this.orders.previewPrice(user.userId, vendorId, linkType, {
      orderDate,
      articleWritingFeeUsd: Number.isFinite(fee) ? fee : undefined,
    });
  }

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('scope') scope: 'all' | 'completed' | 'pending' | 'trash' = 'all',
    @Query() q: OrderListQuery,
  ) {
    return this.orders.list(user.userId, scope, {
      page: q.page,
      limit: q.limit,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      searchUrl: q.searchUrl,
    });
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: OrderBodyDto) {
    return this.orders.create(user.userId, body);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.findOne(user.userId, id);
  }

  @Put(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: OrderBodyDto) {
    return this.orders.update(user.userId, id, body);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.softDelete(user.userId, id);
  }

  @Post(':id/restore-quick')
  restoreQuick(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.restoreQuick(user.userId, id);
  }

  @Post(':id/restore')
  restoreFromTrash(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.restoreFromTrash(user.userId, id);
  }

  @Delete(':id/permanent')
  permanentDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.permanentDelete(user.userId, id);
  }
}
