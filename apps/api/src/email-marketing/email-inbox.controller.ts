import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { EmailInboxService } from './email-inbox.service';

class InboxDemoDto {
  @IsString()
  snippet!: string;

  @IsString()
  fromAddr!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

class SyncMailboxDto {
  @IsString()
  accountId!: string;

  /** Use `all` to sync inbox, sent, and drafts in one request (recommended for mailbox history). */
  @IsIn(['inbox', 'sent', 'drafts', 'all'])
  folder!: 'inbox' | 'sent' | 'drafts' | 'all';
}

@Controller('email-marketing/inbox')
@UseGuards(JwtAuthGuard)
export class EmailInboxController {
  constructor(private readonly inbox: EmailInboxService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
    @Query('accountId') accountId?: string,
    @Query('folder') folder?: string,
  ) {
    const n = Math.min(Math.max(Number.parseInt(limit ?? '50', 10) || 50, 1), 200);
    return this.inbox.list(user.userId, { limit: n, accountId: accountId || undefined, folder: folder || undefined });
  }

  @Post('sync')
  async sync(@CurrentUser() user: JwtUser, @Body() body: SyncMailboxDto) {
    return this.inbox.syncMailbox(user.userId, body.accountId, body.folder);
  }

  @Post('demo')
  async demo(@CurrentUser() user: JwtUser, @Body() body: InboxDemoDto) {
    return this.inbox.addDemo(user.userId, body);
  }
}
