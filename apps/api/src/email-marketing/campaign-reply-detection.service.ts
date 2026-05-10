import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  CampaignRecipientStatus,
  CampaignStatus,
  EmailAccount,
  EmailAccountProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailImapSyncService } from './email-imap-sync.service';
import { EmailOAuthMailService } from './email-oauth-mail.service';
import { heavyEmailSchedulersEnabled } from '../common/email-schedulers-allow';
import { NotificationsService } from '../notifications/notifications.service';

function parseSenderAccountIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Extract `a@b.com` from `Name <a@b.com>` or raw address. */
function extractEmailFromFromHeader(from: string): string | null {
  const t = from.trim();
  const m = t.match(/<([^>]+@[^>]+)>/);
  const raw = (m ? m[1] : t).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

/**
 * Polls sender mailboxes for inbound messages and marks matching campaign recipients as replied.
 * Uses IMAP (SMTP accounts), Gmail API, or Microsoft Graph depending on the account.
 */
@Injectable()
export class CampaignReplyDetectionService {
  private readonly log = new Logger(CampaignReplyDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthMail: EmailOAuthMailService,
    private readonly imapSync: EmailImapSyncService,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval(90_000)
  async scanInboxesForReplies(): Promise<void> {
    if (!heavyEmailSchedulersEnabled()) return;
    const accounts = await this.prisma.emailAccount.findMany({
      where: {
        deletedAt: null,
        OR: [
          { provider: EmailAccountProvider.GMAIL_API },
          { provider: EmailAccountProvider.OUTLOOK },
          { imapPasswordEnc: { not: null } },
        ],
      },
    });
    for (const acc of accounts) {
      try {
        await this.scanAccountInbox(acc);
      } catch (e) {
        this.log.debug(`Reply scan skip account ${acc.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  private async scanAccountInbox(acc: EmailAccount): Promise<void> {
    let rows: { fromAddr: string }[] = [];
    if (acc.provider === EmailAccountProvider.GMAIL_API) {
      rows = await this.oauthMail.fetchGmailMessages(acc, 'inbox', 50);
    } else if (acc.provider === EmailAccountProvider.OUTLOOK) {
      rows = await this.oauthMail.fetchGraphMessages(acc, 'inbox', 50);
    } else if (this.imapSync.hasImapCredentials(acc)) {
      const full = await this.imapSync.fetchMailboxMessages(acc, 'inbox', 50);
      rows = full;
    } else {
      return;
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { userId: acc.userId, deletedAt: null, status: CampaignStatus.RUNNING },
      select: { id: true, senderAccountIds: true },
    });
    const campaignIds = campaigns
      .filter((c) => parseSenderAccountIds(c.senderAccountIds).includes(acc.id))
      .map((c) => c.id);
    if (!campaignIds.length) return;

    const fromSet = new Set<string>();
    for (const r of rows) {
      const e = extractEmailFromFromHeader(r.fromAddr);
      if (e) fromSet.add(e);
    }
    const selfNorm = acc.fromEmail?.trim().toLowerCase() ?? '';
    for (const emailNorm of fromSet) {
      if (selfNorm && emailNorm === selfNorm) continue;
      const n = await this.prisma.campaignRecipient.updateMany({
        where: {
          replied: false,
          campaignId: { in: campaignIds },
          targetEmail: { equals: emailNorm, mode: 'insensitive' },
          // Only mark replies for recipients we've actually sent to.
          lastSentAt: { not: null },
          status: {
            in: [
              CampaignRecipientStatus.PENDING,
              CampaignRecipientStatus.QUEUED,
              CampaignRecipientStatus.ACTIVE,
            ],
          },
        },
        data: { replied: true },
      });
      if (n.count > 0) {
        this.log.log(`Marked ${n.count} recipient(s) as replied (from ${emailNorm}, account ${acc.id}).`);
        await this.notifications.create(acc.userId, {
          kind: 'info',
          title: 'New reply received',
          message: [
            `Account: ${acc.fromEmail}`,
            `From: ${emailNorm}`,
            `Matched recipient(s): ${n.count}`,
          ].join('\n'),
          href: `/email-marketing/mailbox?accountId=${encodeURIComponent(acc.id)}&autoSync=1`,
        });
      }
    }
  }
}
