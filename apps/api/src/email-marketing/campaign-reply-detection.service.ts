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
import type { FetchedInboxMessage } from './email-oauth-mail.service';
import { EmailOAuthMailService } from './email-oauth-mail.service';
import { heavyEmailSchedulersEnabled } from '../common/email-schedulers-allow';
import { NotificationsService } from '../notifications/notifications.service';
import { isLikelyReplyToPriorOutbound } from './reply-detection-heuristics';

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

/** Completed campaigns only get reply backfill for recent sends (avoids ancient inbox noise). */
const REPLY_SCAN_COMPLETED_MAX_AGE_MS = 90 * 86400000;

/**
 * Polls sender mailboxes for inbound messages and marks matching campaign recipients as replied.
 * Uses IMAP (SMTP accounts), Gmail API, or Microsoft Graph depending on the account.
 *
 * Matching is conservative: only messages that look like replies (thread headers or Re:/Fwd: subject)
 * and that arrived after we last sent to that recipient are counted. Campaigns must be RUNNING, PAUSED,
 * or recently COMPLETED (so stats stay accurate after a campaign finishes).
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
    let rows: FetchedInboxMessage[] = [];
    if (acc.provider === EmailAccountProvider.GMAIL_API) {
      rows = await this.oauthMail.fetchGmailMessages(acc, 'inbox', 50);
    } else if (acc.provider === EmailAccountProvider.OUTLOOK) {
      rows = await this.oauthMail.fetchGraphMessages(acc, 'inbox', 50);
    } else if (this.imapSync.hasImapCredentials(acc)) {
      rows = await this.imapSync.fetchMailboxMessages(acc, 'inbox', 50);
    } else {
      return;
    }

    const completedSince = new Date(Date.now() - REPLY_SCAN_COMPLETED_MAX_AGE_MS);
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        userId: acc.userId,
        deletedAt: null,
        OR: [
          { status: { in: [CampaignStatus.RUNNING, CampaignStatus.PAUSED, CampaignStatus.SCHEDULED] } },
          {
            status: CampaignStatus.COMPLETED,
            OR: [{ completedAt: { gte: completedSince } }, { completedAt: null }],
          },
        ],
      },
      select: { id: true, senderAccountIds: true },
    });
    const campaignIds = campaigns
      .filter((c) => parseSenderAccountIds(c.senderAccountIds).includes(acc.id))
      .map((c) => c.id);
    if (!campaignIds.length) return;

    const selfNorm = acc.fromEmail?.trim().toLowerCase() ?? '';

    for (const msg of rows) {
      if (!isLikelyReplyToPriorOutbound(msg)) continue;

      const emailNorm = extractEmailFromFromHeader(msg.fromAddr);
      if (!emailNorm) continue;
      if (selfNorm && emailNorm === selfNorm) continue;

      const receivedAt = msg.receivedAt;
      if (Number.isNaN(receivedAt.getTime())) continue;

      const n = await this.prisma.campaignRecipient.updateMany({
        where: {
          replied: false,
          campaignId: { in: campaignIds },
          targetEmail: { equals: emailNorm, mode: 'insensitive' },
          lastSentAt: { not: null, lt: receivedAt },
          status: {
            in: [
              CampaignRecipientStatus.PENDING,
              CampaignRecipientStatus.QUEUED,
              CampaignRecipientStatus.ACTIVE,
              CampaignRecipientStatus.COMPLETED,
            ],
          },
        },
        data: { replied: true },
      });
      if (n.count > 0) {
        this.log.log(
          `Marked ${n.count} recipient(s) as replied (from ${emailNorm}, msg ${msg.externalMessageId}, account ${acc.id}).`,
        );
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
