import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { RevenueService } from '../revenue/revenue.service';
import { DashboardInsightsService } from './dashboard-insights.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(
    private readonly revenue: RevenueService,
    private readonly insights: DashboardInsightsService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.revenue.dashboardStats(user.userId);
  }

  @Get('dashboard/insights')
  dashboardInsights(
    @CurrentUser() user: JwtUser,
    @Query('leads') leads?: string,
    @Query('delivery') delivery?: string,
    @Query('response') response?: string,
    @Query('revenue') revenue?: string,
    @Query('profit') profit?: string,
  ) {
    return this.insights.getInsights(user.userId, { leads, delivery, response, revenue, profit });
  }

  @Get('dashboard/snapshot')
  dashboardSnapshot(@CurrentUser() user: JwtUser) {
    return this.insights.getSnapshot(user.userId);
  }

  @Get('dashboard/metric')
  dashboardMetric(
    @CurrentUser() user: JwtUser,
    @Query('k') k?: string,
    @Query('range') range?: string,
  ) {
    return this.insights.getMetric(user.userId, k, range);
  }

  @Get('dashboard/highlight')
  dashboardHighlight(@CurrentUser() user: JwtUser, @Query('kind') kind?: string) {
    return this.insights.getHighlight(user.userId, kind);
  }
}
