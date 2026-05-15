import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { RevenueService } from './revenue.service';

class RevQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['total', 'last_month'])
  scope: 'total' | 'last_month' = 'total';
}

@Controller('revenue')
@UseGuards(JwtAuthGuard)
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get('orders')
  list(@CurrentUser() user: JwtUser, @Query() q: RevQuery) {
    return this.revenue.revenueOrders(user.userId, q.scope, q.page, q.limit);
  }
}
