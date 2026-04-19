import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { RevenueService } from '../revenue/revenue.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly revenue: RevenueService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.revenue.dashboardStats(user.userId);
  }
}
