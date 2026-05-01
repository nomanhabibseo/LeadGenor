import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UsersController } from './users.controller';

@Module({
  imports: [SubscriptionModule],
  controllers: [UsersController],
})
export class UsersModule {}
