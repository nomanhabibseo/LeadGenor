import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SmtpEncryption } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import * as nodemailer from 'nodemailer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { EmailAccountsService } from './email-accounts.service';
import { EmailImapSyncService } from './email-imap-sync.service';

class CreateSmtpDto {
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEmail()
  fromEmail!: string;

  @IsString()
  tag!: string;

  @IsString()
  smtpHost!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  smtpPassword!: string;

  @IsEnum(SmtpEncryption)
  smtpEncryption!: SmtpEncryption;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayMinSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayMaxSec?: number;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  bcc?: string;

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsString()
  imapUser?: string;

  @IsOptional()
  @IsString()
  imapPassword?: string;

  @IsOptional()
  @IsEnum(SmtpEncryption)
  imapEncryption?: SmtpEncryption;
}

class UpdateAccountDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsEnum(SmtpEncryption)
  smtpEncryption?: SmtpEncryption;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayMinSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayMaxSec?: number;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  bcc?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  imapHost?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  imapPort?: number | null;

  @IsOptional()
  @IsString()
  imapUser?: string | null;

  @IsOptional()
  @IsString()
  imapPassword?: string;

  @IsOptional()
  @IsEnum(SmtpEncryption)
  imapEncryption?: SmtpEncryption;

  @IsOptional()
  @IsBoolean()
  campaignsEnabled?: boolean;
}

class VerifyOnlyDto {
  @IsString()
  smtpHost!: string;

  @Type(() => Number)
  @IsInt()
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  smtpPassword!: string;

  @IsEnum(SmtpEncryption)
  smtpEncryption!: SmtpEncryption;

  @IsEmail()
  fromEmail!: string;
}

class VerifyCredentialsDto {
  @IsString()
  smtpHost!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  smtpPassword!: string;

  @IsEnum(SmtpEncryption)
  smtpEncryption!: SmtpEncryption;

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsString()
  imapUser?: string;

  @IsOptional()
  @IsString()
  imapPassword?: string;

  @IsOptional()
  @IsEnum(SmtpEncryption)
  imapEncryption?: SmtpEncryption;
}

@Controller('email-marketing/accounts')
@UseGuards(JwtAuthGuard)
export class EmailAccountsController {
  constructor(
    private readonly accounts: EmailAccountsService,
    private readonly imapSync: EmailImapSyncService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUser) {
    return this.accounts.list(user.userId);
  }

  @Get('availability')
  async availability(
    @CurrentUser() user: JwtUser,
    @Query('displayName') displayName?: string,
    @Query('tag') tag?: string,
  ) {
    return this.accounts.availability(user.userId, displayName, tag);
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() body: CreateSmtpDto) {
    const acc = await this.accounts.createSmtp(user.userId, body);
    return this.accounts.maskAccount(acc);
  }

  @Post('verify-connection')
  async verifyOnly(@Body() body: VerifyOnlyDto) {
    const secure = body.smtpEncryption === SmtpEncryption.SSL;
    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure,
      auth: { user: body.smtpUser, pass: body.smtpPassword },
      requireTLS: body.smtpEncryption === SmtpEncryption.TLS,
    });
    await transporter.verify();
    return { ok: true };
  }

  @Post('verify-credentials')
  async verifyCredentials(@Body() body: VerifyCredentialsDto) {
    const secure = body.smtpEncryption === SmtpEncryption.SSL;
    const transporter = nodemailer.createTransport({
      host: body.smtpHost.trim(),
      port: body.smtpPort,
      secure,
      auth: { user: body.smtpUser.trim(), pass: body.smtpPassword },
      requireTLS: body.smtpEncryption === SmtpEncryption.TLS,
    });
    try {
      await transporter.verify();
    } catch {
      throw new BadRequestException(
        'SMTP: The username or password you entered is incorrect. Please enter the correct SMTP credentials and try again.',
      );
    }

    const hasImap = !!(body.imapHost?.trim() && body.imapPort && body.imapUser?.trim() && body.imapPassword?.length);
    if (hasImap) {
      await this.imapSync.verifyImapPlain({
        imapHost: body.imapHost!.trim(),
        imapPort: body.imapPort!,
        imapUser: body.imapUser!.trim(),
        imapPassword: body.imapPassword!,
        imapEncryption: body.imapEncryption ?? SmtpEncryption.TLS,
      });
    }

    return { ok: true };
  }

  @Get(':id')
  async one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounts.getOne(user.userId, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: UpdateAccountDto) {
    const acc = await this.accounts.update(user.userId, id, body);
    return this.accounts.maskAccount(acc);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounts.delete(user.userId, id);
  }

  @Post(':id/verify')
  async verify(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    await this.accounts.verifySmtp(user.userId, id);
    return { ok: true };
  }
}
