import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { EmailFinderController } from './email-finder.controller';
import { EmailFinderService } from './email-finder.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [EmailFinderController],
  providers: [EmailFinderService],
})
export class EmailFinderModule {}

