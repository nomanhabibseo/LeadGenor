import { BadRequestException, Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';

class LookupUserDto {
  @IsEmail()
  email!: string;
}

class ActivateSubscriptionDto {
  @IsEmail()
  email!: string;

  @IsEnum(SubscriptionTier)
  tier!: SubscriptionTier;

  /** Required for paid tiers (PRO/BUSINESS). ISO string (e.g. 2026-06-01T00:00:00.000Z). */
  @IsOptional()
  @IsString()
  endsAtIso?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users/lookup')
  async lookup(@Query() q: LookupUserDto) {
    const email = q.email.trim().toLowerCase();
    const u = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        subscriptionTier: true,
        subscriptionEndsAt: true,
        planChosenAt: true,
      },
    });
    return { user: u };
  }

  @Patch('subscriptions/activate')
  async activate(@Body() body: ActivateSubscriptionDto) {
    const email = body.email.trim().toLowerCase();
    const now = new Date();

    let endsAt: Date | null = null;
    if (body.tier === SubscriptionTier.FREE) {
      endsAt = null;
    } else {
      const raw = (body.endsAtIso ?? '').trim();
      if (!raw) {
        throw new BadRequestException('endsAtIso is required for paid plans.');
      }
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('endsAtIso must be a valid ISO date string.');
      }
      endsAt = d;
    }

    const updated = await this.prisma.user.update({
      where: { email },
      data: {
        subscriptionTier: body.tier,
        subscriptionEndsAt: endsAt,
        // Keep onboarding simple: once admin activates a plan, user is considered "chosen".
        planChosenAt: { set: now },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        subscriptionTier: true,
        subscriptionEndsAt: true,
        planChosenAt: true,
      },
    });

    return { user: updated };
  }
}

