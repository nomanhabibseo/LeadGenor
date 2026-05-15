import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';

class ChoosePlanDto {
  /** Optional telemetry only; tiers are upgraded manually after payment verification. */
  @IsOptional()
  @IsIn(['FREE', 'PRO', 'BUSINESS'])
  interest?: string;
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionService,
  ) {}

  /** Public catalog payload (still requires login). */
  @Get('plans')
  plans() {
    return this.subscription.plansCatalog();
  }

  @Post('choose-plan')
  async choosePlan(@CurrentUser() user: JwtUser, @Body() body: ChoosePlanDto) {
    const interest = body.interest;
    await this.prisma.user.update({
      where: { id: user.userId },
      data:
        interest === 'FREE'
          ? {
              // Free becomes active immediately
              planChosenAt: new Date(),
              subscriptionTier: 'FREE',
              subscriptionEndsAt: null,
            }
          : {
              // Pro/Business chosen: manual activation later
              planChosenAt: new Date(),
            },
    });
    return { ok: true };
  }

  /** Same projection as `/users/me` → `subscription` (convenience for React Query). */
  @Get('state')
  state(@CurrentUser() user: JwtUser) {
    return this.subscription.mergeDashboardState(user.userId);
  }
}
