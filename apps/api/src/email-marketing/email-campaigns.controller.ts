import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { CampaignSendService } from './campaign-send.service';
import type { ChainStep } from './email-campaigns.service';
import { EmailCampaignsService } from './email-campaigns.service';

class CreateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;
}

class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  emailListId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wizardStep?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  senderAccountIds?: string[];

  @IsOptional()
  @IsBoolean()
  doNotSendUnverified?: boolean;

  @IsOptional()
  @IsBoolean()
  doNotSendRisky?: boolean;

  @IsOptional()
  @IsBoolean()
  doNotSendInvalid?: boolean;

  @IsOptional()
  @IsEnum(['ALL', 'FIRST'] as const)
  multiEmailPolicy?: 'ALL' | 'FIRST';

  @IsOptional()
  @IsBoolean()
  skipIfInOtherCampaign?: boolean;

  @IsOptional()
  @IsEnum(['TO_CHECK_LIST', 'SEND_ANYWAY'] as const)
  missingVariablePolicy?: 'TO_CHECK_LIST' | 'SEND_ANYWAY';

  @IsOptional()
  mainSequence?: ChainStep[];

  @IsOptional()
  followUpSequence?: ChainStep[];

  @IsOptional()
  followUpStartRule?: Record<string, unknown>;

  @IsOptional()
  @Allow()
  mainFlowGraph?: unknown;

  @IsOptional()
  @IsString()
  pauseReason?: string | null;

  @IsOptional()
  @IsBoolean()
  stopFollowUpsOnReply?: boolean;

  @IsOptional()
  @IsBoolean()
  stopCampaignOnCompanyReply?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyCampaignLimit?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

class StartCampaignDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsBoolean()
  skipRecipientBuild?: boolean;
}

class PauseCampaignDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('email-marketing/campaigns')
@UseGuards(JwtAuthGuard)
export class EmailCampaignsController {
  constructor(
    private readonly campaigns: EmailCampaignsService,
    private readonly campaignSend: CampaignSendService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUser) {
    return this.campaigns.list(user.userId);
  }

  @Get('reports/completed')
  async reportsCompleted(@CurrentUser() user: JwtUser) {
    return this.campaigns.completedReports(user.userId);
  }

  @Get('reports/sends')
  async reportsSends(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    const raw = String(status ?? '').trim();
    const statuses =
      raw === 'COMPLETED'
        ? [CampaignStatus.COMPLETED]
        : raw === 'RUNNING'
          ? [CampaignStatus.RUNNING]
          : [CampaignStatus.RUNNING, CampaignStatus.COMPLETED];
    return this.campaigns.sendReports(user.userId, statuses);
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() body: CreateCampaignDto) {
    return this.campaigns.createDraft(user.userId, body.name ?? 'New campaign');
  }

  @Get(':id')
  async get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.get(user.userId, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: UpdateCampaignDto) {
    const payload: Record<string, unknown> = { ...body };
    if (body.scheduledAt !== undefined) {
      payload.scheduledAt =
        body.scheduledAt === null || body.scheduledAt === ''
          ? null
          : new Date(body.scheduledAt as string);
    }
    return this.campaigns.update(user.userId, id, payload);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.delete(user.userId, id);
  }

  @Post(':id/pause')
  async pause(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: PauseCampaignDto) {
    return this.campaigns.pause(user.userId, id, body.reason);
  }

  @Post(':id/build-recipients')
  async build(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.buildRecipients(user.userId, id);
  }

  @Post(':id/start')
  async start(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: StartCampaignDto) {
    const updated = await this.campaigns.start(user.userId, id, {
      scheduledAt: body.scheduledAt,
      skipRecipientBuild: body.skipRecipientBuild,
    });
    await this.campaignSend.tick();
    return updated;
  }

  @Get(':id/reports/sends/accounts/:accountId')
  async reportAccount(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Query('take') take?: string,
  ) {
    const n = Number(take ?? 200);
    return this.campaigns.sendReportAccountDrilldown(user.userId, id, accountId, Number.isFinite(n) ? n : 200);
  }
}
