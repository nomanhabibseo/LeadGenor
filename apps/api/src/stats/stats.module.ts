import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module';
import { RevenueModule } from '../revenue/revenue.module';
import { StatsController } from './stats.controller';
import { DashboardInsightsService } from './dashboard-insights.service';

@Module({
  imports: [RevenueModule, FxModule],
  controllers: [StatsController],
  providers: [DashboardInsightsService],
})
export class StatsModule {}
