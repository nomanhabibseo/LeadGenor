import { Module } from '@nestjs/common';
import { RevenueModule } from '../revenue/revenue.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [RevenueModule],
  controllers: [StatsController],
})
export class StatsModule {}
