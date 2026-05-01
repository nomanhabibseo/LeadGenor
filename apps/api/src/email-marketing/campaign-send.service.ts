import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  CampaignRecipientStatus,
  CampaignStatus,
  EmailAccount,
  EmailAccountProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAccountsService } from './email-accounts.service';
import { resolveMainChainFromCampaign, type ChainStep } from './compile-main-flow';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailOAuthMailService } from './email-oauth-mail.service';
import { htmlToPlainText } from './email-html-plain';
import { applyMergeTemplate, buildMergeVars } from './merge-tags';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  INLINE_UNSUBSCRIBE_HREF,
  bodyHasInlineUnsubscribe,
  expandLgUnsubTokensToAnchor,
} from './inline-unsub-placeholder';

const API_PUBLIC = process.env.API_PUBLIC_URL || process.env.API_URL || 'http://127.0.0.1:4000';

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

@Injectable()
export class CampaignSendService {
  private readonly log = new Logger(CampaignSendService.name);
  private tickRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: EmailAccountsService,
    private readonly campaigns: EmailCampaignsService,
    private readonly oauthMail: EmailOAuthMailService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** Release rows left ACTIVE after a crash mid-send (claim uses ACTIVE as a lock). */
  @Interval(120_000)
  async recoverStuckActiveRecipients() {
    const threshold = new Date(Date.now() - 20 * 60 * 1000);
    const r = await this.prisma.campaignRecipient.updateMany({
      where: {
        status: CampaignRecipientStatus.ACTIVE,
        updatedAt: { lt: threshold },
      },
      data: { status: CampaignRecipientStatus.QUEUED },
    });
    if (r.count > 0) {
      this.log.warn(`Released ${r.count} campaign recipient row(s) stuck in ACTIVE after timeout.`);
    }
  }

  /** Polling loop for due sends. Kept at 1s to respect per-account second-level delays. */
  @Interval(1_000)
  async tick() {
    if (this.tickRunning) return;
    this.tickRunning = true;
    try {
    const now = new Date();
    // Promote scheduled campaigns whose start time has arrived.
    await this.prisma.campaign.updateMany({
      where: {
        deletedAt: null,
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      data: { status: CampaignStatus.RUNNING, startedAt: now },
    });

      // Recovery: if a campaign was previously deferred far into the future (e.g. old UTC-midnight logic),
      // and the first email was never sent, bring a few rows back to "due" so the campaign can start.
      const deferred = await this.prisma.campaignRecipient.findMany({
        where: {
          status: CampaignRecipientStatus.QUEUED,
          lastSentAt: null,
          nextSendAt: { gt: now },
          campaign: { is: { status: CampaignStatus.RUNNING, deletedAt: null } },
        },
        include: { campaign: true },
        take: 25,
        orderBy: [{ nextSendAt: 'asc' }],
      });
      for (const r of deferred) {
        const senderIds = parseSenderAccountIds(r.campaign.senderAccountIds);
        if (!senderIds.length) continue;
        const acc = await this.pickEligibleSenderAccount(senderIds, r.campaign.userId);
        if (!acc) continue;
        await this.prisma.campaignRecipient.updateMany({
          where: { id: r.id, status: CampaignRecipientStatus.QUEUED },
          data: { nextSendAt: null },
        });
      }

    const due = await this.prisma.campaignRecipient.findMany({
      where: {
        /** Only QUEUED: ACTIVE is an in-flight lock; parallel ticks must not process the same row twice. */
        status: CampaignRecipientStatus.QUEUED,
        OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
        campaign: { is: { status: CampaignStatus.RUNNING, deletedAt: null } },
      },
      include: {
        campaign: true,
        emailListItem: true,
      },
      take: 25,
      orderBy: [{ nextSendAt: { sort: 'asc', nulls: 'first' } }],
    });

    for (const rec of due) {
      try {
        await this.processRecipient(rec);
      } catch (e) {
        this.log.error(`Recipient ${rec.id}`, e);
      }
    }
    } finally {
      this.tickRunning = false;
    }
  }

  private async revertRecipientToQueued(recId: string, nextSendAt: Date | null) {
    await this.prisma.campaignRecipient.updateMany({
      where: { id: recId, status: CampaignRecipientStatus.ACTIVE },
      data: { status: CampaignRecipientStatus.QUEUED, nextSendAt },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processRecipient(rec: any) {
    const camp = rec.campaign;
    await this.subscriptions.enforceMonthlyEmailSendBudget(camp.userId);
    const alive = await this.prisma.campaign.findUnique({
      where: { id: camp.id },
      select: { status: true },
    });
    if (alive?.status !== CampaignStatus.RUNNING) return;

    const now = new Date();
    const preserveNext = rec.nextSendAt as Date | null;

    const claimed = await this.prisma.campaignRecipient.updateMany({
      where: {
        id: rec.id,
        status: CampaignRecipientStatus.QUEUED,
        OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
      },
      data: { status: CampaignRecipientStatus.ACTIVE },
    });
    if (claimed.count === 0) return;

    try {
      await this.processRecipientAfterClaim(rec, camp, preserveNext);
    } catch (e) {
      await this.revertRecipientToQueued(rec.id, preserveNext);
      throw e;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processRecipientAfterClaim(rec: any, camp: any, preserveNext: Date | null) {
    const suppressed = await this.prisma.emailSuppression.findUnique({
      where: {
        userId_emailNorm: { userId: camp.userId, emailNorm: rec.targetEmail.toLowerCase() },
      },
    });
    if (suppressed) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: { status: CampaignRecipientStatus.UNSUBSCRIBED, nextSendAt: null },
      });
      return;
    }

    if (rec.replied === true) {
      const stopFollowUp =
        rec.phase === 'followup' &&
        (camp.stopFollowUpsOnReply === true || camp.stopCampaignOnCompanyReply === true);
      const stopMain = rec.phase === 'main' && camp.stopCampaignOnCompanyReply === true;
      if (stopFollowUp || stopMain) {
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: { status: CampaignRecipientStatus.COMPLETED, nextSendAt: null },
        });
        await this.markCampaignCompletedIfIdle(camp.id);
        return;
      }
    }

    const senderIds = parseSenderAccountIds(camp.senderAccountIds);
    if (!senderIds.length) {
      this.log.warn(`Campaign ${camp.id}: recipient ${rec.id} skipped — no sender accounts on campaign.`);
      await this.revertRecipientToQueued(rec.id, preserveNext);
      return;
    }

    const chain: ChainStep[] =
      rec.phase === 'main'
        ? resolveMainChainFromCampaign(camp)
        : ((camp.followUpSequence as unknown as ChainStep[]) ?? []).filter((x) => x?.templateId);
    const step = chain[rec.stepIndex];
    if (!step?.templateId) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: { status: CampaignRecipientStatus.COMPLETED, nextSendAt: null },
      });
      await this.markCampaignCompletedIfIdle(camp.id);
      return;
    }

    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: step.templateId, userId: camp.userId, deletedAt: null },
    });
    if (!template) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: { status: CampaignRecipientStatus.FAILED, failReason: 'Template missing' },
      });
      return;
    }

    const acc = await this.pickEligibleSenderAccount(senderIds, camp.userId);
    if (!acc) {
      const deferUntil = await this.computeDeferUntil(senderIds, camp.userId);
      this.log.debug(`Campaign ${camp.id}: no sender capacity — retry after ${deferUntil.toISOString()}`);
      await this.revertRecipientToQueued(rec.id, deferUntil);
      return;
    }

    const accountId = acc.id;

    const canSmtp =
      (acc.provider === EmailAccountProvider.SMTP ||
        acc.provider === EmailAccountProvider.GMAIL_SMTP ||
        acc.provider === EmailAccountProvider.OTHER) &&
      !!acc.smtpPasswordEnc &&
      !!acc.smtpHost;
    const canOAuth =
      (acc.provider === EmailAccountProvider.GMAIL_API || acc.provider === EmailAccountProvider.OUTLOOK) &&
      !!acc.oauthRefreshEnc;
    if (!canSmtp && !canOAuth) {
      this.log.warn(
        `Campaign ${camp.id}: account ${acc.id} (${acc.provider}) cannot send — configure SMTP password or OAuth.`,
      );
      await this.revertRecipientToQueued(rec.id, preserveNext);
      return;
    }

    let smtpPass: string | null = null;
    if (canSmtp) {
      smtpPass = await this.accounts.getDecryptedPassword(acc.id);
      if (!smtpPass) {
        this.log.warn(`Campaign ${camp.id}: SMTP password missing for account ${acc.id}.`);
        await this.revertRecipientToQueued(rec.id, preserveNext);
        return;
      }
    }

    const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (camp.dailyCampaignLimit != null && camp.dailyCampaignLimit > 0) {
      const n = await this.prisma.campaignRecipient.count({
        where: {
          campaignId: camp.id,
          lastSentAt: { gte: dayStart },
        },
      });
      if (n >= camp.dailyCampaignLimit) {
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);
        this.log.warn(
          `Campaign ${camp.id}: daily cap ${camp.dailyCampaignLimit} reached for UTC day (${n} sends); deferring.`,
        );
        await this.revertRecipientToQueued(rec.id, nextDay);
        return;
      }
    }

    if (/localhost|127\.0\.0\.1/i.test(API_PUBLIC)) {
      this.log.warn(
        `API_PUBLIC_URL is "${API_PUBLIC}". Opens/unsubscribes will NOT track for real recipients. Set API_PUBLIC_URL to your public API domain.`,
      );
    }

    const token = await this.campaigns.createUnsubscribeToken(camp.userId, rec.targetEmail.toLowerCase());
    const unsubscribeUrl = `${API_PUBLIC.replace(/\/$/, '')}/public/unsubscribe?t=${encodeURIComponent(token)}`;
    const openUrl = `${API_PUBLIC.replace(/\/$/, '')}/public/email/open/${rec.id}`;

    const item = rec.emailListItem;
    const vars = buildMergeVars(item);
    const subject = applyMergeTemplate(template.subject, vars);
    const mergedBody = applyMergeTemplate(template.body, vars);
    const hasInlineUnsub = bodyHasInlineUnsubscribe(mergedBody);
    let bodyHtml = expandLgUnsubTokensToAnchor(mergedBody, unsubscribeUrl)
      .split(INLINE_UNSUBSCRIBE_HREF)
      .join(unsubscribeUrl)
      .replace(/\n/g, '<br/>');
    if (template.includeUnsubscribeBlock && !hasInlineUnsub) {
      bodyHtml += `<br/><br/><a href="${unsubscribeUrl}">Unsubscribe</a>`;
    }
    if (acc.signature) {
      bodyHtml += `<br/><br/>${acc.signature.replace(/\n/g, '<br/>')}`;
    }
    bodyHtml += `<img src="${openUrl}" width="1" height="1" alt="" />`;

    const plainBody = htmlToPlainText(bodyHtml);

    const dLo = Number(acc.delayMinSec) || 60;
    const dHi = Number(acc.delayMaxSec) || 60;
    const lo = Math.min(dLo, dHi);
    const hi = Math.max(dLo, dHi);
    const jitterMs = (Math.floor(Math.random() * (hi - lo + 1)) + lo) * 1000;

    const listUnsub = unsubscribeUrl;
    try {
      if (canSmtp && smtpPass) {
        const transporter = this.accounts.buildTransport(
          {
            smtpHost: acc.smtpHost,
            smtpPort: acc.smtpPort,
            smtpUser: acc.smtpUser,
            smtpEncryption: acc.smtpEncryption,
            fromEmail: acc.fromEmail,
          },
          smtpPass,
        );
        await transporter.sendMail({
          from: `"${acc.displayName}" <${acc.fromEmail}>`,
          to: rec.targetEmail,
          bcc: acc.bcc || undefined,
          subject,
          text: plainBody,
          html: bodyHtml,
          headers: { 'List-Unsubscribe': `<${listUnsub}>` },
        });
      } else if (acc.provider === EmailAccountProvider.GMAIL_API) {
        await this.oauthMail.sendGmail(acc, {
          to: rec.targetEmail,
          subject,
          html: bodyHtml,
          text: plainBody,
          listUnsubscribe: listUnsub,
          bcc: acc.bcc || undefined,
        });
      } else if (acc.provider === EmailAccountProvider.OUTLOOK) {
        await this.oauthMail.sendMicrosoftGraph(acc, {
          to: rec.targetEmail,
          subject,
          html: bodyHtml,
          listUnsubscribe: listUnsub,
          bcc: acc.bcc || undefined,
        });
      } else {
        this.log.warn(`Campaign ${camp.id}: no send path for provider ${acc.provider} on account ${acc.id}.`);
        await this.revertRecipientToQueued(rec.id, preserveNext);
        return;
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Send failed';
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status: CampaignRecipientStatus.FAILED,
          failReason: msg.slice(0, 240),
          nextSendAt: null,
        },
      });
      try {
        await this.notifications.create(camp.userId, {
          kind: 'error',
          title: 'Email not delivered',
          message: [
            `Campaign: ${camp.name}`,
            `To: ${rec.targetEmail}`,
            `Site: ${item.siteUrl}`,
            `Reason: ${msg.slice(0, 240)}`,
          ].join('\n'),
          href: `/email-marketing/campaigns/${encodeURIComponent(camp.id)}`,
        });
      } catch {
        // Notifications are best-effort; sending flow must not crash on notify failures.
      }
      this.log.warn(`Campaign ${camp.id}: send failed for recipient ${rec.id} via account ${acc.id}: ${msg}`);
      await this.markCampaignCompletedIfIdle(camp.id);
      return;
    }

    // Log for reporting (campaign → account usage).
    await this.prisma.campaignSendLog.create({
      data: {
        userId: camp.userId,
        campaignId: camp.id,
        recipientId: rec.id,
        emailAccountId: acc.id,
        targetEmail: rec.targetEmail,
      },
    });

    const cooldownUntil = new Date(Date.now() + jitterMs);
    await this.accounts.incrementSent(acc.id, cooldownUntil);

    const nextIdx = rec.stepIndex + 1;
    const delayDays = step.delayDaysBeforeNext ?? 0;
    const base = Date.now() + delayDays * 86400000 + jitterMs;

    if (nextIdx >= chain.length) {
      if (rec.phase === 'main' && ((camp.followUpSequence as unknown as ChainStep[]) ?? []).length) {
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            phase: 'followup',
            stepIndex: 0,
            nextSendAt: new Date(base),
            lastSentAt: new Date(),
            status: CampaignRecipientStatus.QUEUED,
          },
        });
      } else {
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            status: CampaignRecipientStatus.COMPLETED,
            nextSendAt: null,
            lastSentAt: new Date(),
          },
        });
        await this.markCampaignCompletedIfIdle(camp.id);
      }
    } else {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          stepIndex: nextIdx,
          nextSendAt: new Date(base),
          lastSentAt: new Date(),
          status: CampaignRecipientStatus.QUEUED,
        },
      });
    }
  }

  /** Pick sender with lowest utilization today (among under daily cap + not in inter-send cooldown). */
  private async pickEligibleSenderAccount(
    senderIds: string[],
    userId: string,
  ): Promise<EmailAccount | null> {
    const now = new Date();
    type Cand = { acc: EmailAccount; util: number };
    const cands: Cand[] = [];
    for (const sid of senderIds) {
      const refreshed = await this.accounts.ensureDailyCounter(sid);
      if (!refreshed || refreshed.userId !== userId) continue;
      if (!refreshed.campaignsEnabled) continue;
      if (refreshed.sentToday >= refreshed.dailyLimit) continue;
      if (refreshed.nextSendAllowedAt && refreshed.nextSendAllowedAt > now) continue;
      const util = refreshed.sentToday / Math.max(refreshed.dailyLimit, 1);
      cands.push({ acc: refreshed, util });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => (a.util !== b.util ? a.util - b.util : a.acc.id.localeCompare(b.acc.id)));
    return cands[0]!.acc;
  }

  /** When no account can send now: next UTC midnight if caps block, else earliest cooldown. */
  private async computeDeferUntil(senderIds: string[], userId: string): Promise<Date> {
    const now = Date.now();
    const d = new Date();
    const nextLocalMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
    let earliest = nextLocalMidnight;
    for (const sid of senderIds) {
      const a = await this.accounts.ensureDailyCounter(sid);
      if (!a || a.userId !== userId) continue;
      if (a.sentToday >= a.dailyLimit) {
        earliest = Math.min(earliest, nextLocalMidnight);
      } else if (a.nextSendAllowedAt && a.nextSendAllowedAt.getTime() > now) {
        earliest = Math.min(earliest, a.nextSendAllowedAt.getTime());
      }
    }
    // Avoid artificially adding multiple seconds of extra delay; next tick is 1s.
    return new Date(Math.max(earliest, now + 1000));
  }

  private async markCampaignCompletedIfIdle(campaignId: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!c || c.deletedAt || c.status !== CampaignStatus.RUNNING) return;
    const pending = await this.prisma.campaignRecipient.count({
      where: {
        campaignId,
        status: {
          in: [
            CampaignRecipientStatus.PENDING,
            CampaignRecipientStatus.QUEUED,
            CampaignRecipientStatus.ACTIVE,
          ],
        },
      },
    });
    if (pending > 0) return;
    const total = await this.prisma.campaignRecipient.count({ where: { campaignId } });
    if (total === 0) return;
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });
  }
}
