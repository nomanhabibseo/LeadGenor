import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  CampaignRecipientStatus,
  CampaignStatus,
  EmailAccount,
  EmailAccountProvider,
  SendConflictPriority,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAccountsService } from './email-accounts.service';
import {
  getFollowUpV2,
  resolveMainChainFromCampaign,
  type ChainStep,
} from './compile-main-flow';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailOAuthMailService } from './email-oauth-mail.service';
import { htmlToPlainText } from './email-html-plain';
import { applyMergeTemplate, buildMergeVars } from './merge-tags';
import { heavyEmailSchedulersEnabled } from '../common/email-schedulers-allow';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  INLINE_UNSUBSCRIBE_HREF,
  bodyHasInlineUnsubscribe,
  expandLgUnsubTokensToAnchor,
} from './inline-unsub-placeholder';

const API_PUBLIC = process.env.API_PUBLIC_URL || process.env.API_URL || 'http://127.0.0.1:4000';

const FU_PHASE_IDLE = 'idle';
const FU_PHASE_WAIT = 'wait';
const FU_PHASE_ACTIVE = 'active';
const FU_PHASE_DONE = 'done';

function computeMirroredNextSendAt(data: {
  nextMainSendAt: Date | null;
  nextFollowupSendAt: Date | null;
  followupPhase: string;
}): Date | null {
  const times: number[] = [];
  if (data.nextMainSendAt != null) times.push(data.nextMainSendAt.getTime());
  if (
    data.followupPhase === FU_PHASE_WAIT ||
    data.followupPhase === FU_PHASE_ACTIVE
  ) {
    if (data.nextFollowupSendAt != null) times.push(data.nextFollowupSendAt.getTime());
    else if (data.followupPhase === FU_PHASE_ACTIVE) times.push(0);
  }
  if (!times.length) return null;
  return new Date(Math.min(...times));
}

const CAMPAIGN_SEND_POLL_MS =
  Number.parseInt(process.env.CAMPAIGN_SEND_TICK_MS ?? '', 10) > 0
    ? Number.parseInt(process.env.CAMPAIGN_SEND_TICK_MS ?? '', 10)
    : process.env.NODE_ENV === 'production'
      ? 1_000
      : 15_000;

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

type SendTrack = 'main' | 'followup';

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

  private dayStartLocal(d = new Date()): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(d: Date, days: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async advanceFollowupWaitIfDue(rec: any) {
    const camp = rec.campaign;
    const rule = getFollowUpV2(camp);
    if (!rule) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status: CampaignRecipientStatus.COMPLETED,
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
          followupPhase: FU_PHASE_DONE,
          phase: 'main',
        },
      });
      await this.markCampaignCompletedIfIdle(camp.id);
      return;
    }

    const now = new Date();
    const claimed = await this.prisma.campaignRecipient.updateMany({
      where: {
        id: rec.id,
        status: CampaignRecipientStatus.QUEUED,
        followupPhase: FU_PHASE_WAIT,
        nextFollowupSendAt: { lte: now },
      },
      data: { status: CampaignRecipientStatus.ACTIVE },
    });
    if (claimed.count === 0) return;

    const opened = rec.opened === true;
    const replied = rec.replied === true;
    const branch = opened && !replied ? 'yes' : 'no';
    const chain = branch === 'yes' ? rule.yesChain : rule.noChain;
    if (!chain.length || !chain[0]?.templateId) {
      const nextMir = computeMirroredNextSendAt({
        nextMainSendAt: rec.nextMainSendAt as Date | null,
        nextFollowupSendAt: null,
        followupPhase: FU_PHASE_DONE,
      });
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status:
            rec.nextMainSendAt == null
              ? CampaignRecipientStatus.COMPLETED
              : CampaignRecipientStatus.QUEUED,
          nextFollowupSendAt: null,
          followupPhase: FU_PHASE_DONE,
          followBranch: branch,
          nextSendAt: nextMir,
          phase: rec.nextMainSendAt == null ? 'main' : 'followup',
        },
      });
      await this.maybeMarkRecipientComplete(rec.id, camp.id);
      return;
    }

    const nextMir = computeMirroredNextSendAt({
      nextMainSendAt: rec.nextMainSendAt as Date | null,
      nextFollowupSendAt: new Date(),
      followupPhase: FU_PHASE_ACTIVE,
    });
    await this.prisma.campaignRecipient.update({
      where: { id: rec.id },
      data: {
        phase: 'followup',
        followBranch: branch,
        followupStepIndex: 0,
        stepIndex: 0,
        nextFollowupSendAt: new Date(),
        followupPhase: FU_PHASE_ACTIVE,
        status: CampaignRecipientStatus.QUEUED,
        nextSendAt: nextMir,
      },
    });
  }

  @Interval(120_000)
  async recoverStuckActiveRecipients() {
    if (!heavyEmailSchedulersEnabled()) return;
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

  @Interval(CAMPAIGN_SEND_POLL_MS)
  async tick() {
    if (!heavyEmailSchedulersEnabled()) return;
    if (this.tickRunning) return;
    this.tickRunning = true;
    try {
      const now = new Date();
      await this.prisma.campaign.updateMany({
        where: {
          deletedAt: null,
          status: CampaignStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        data: { status: CampaignStatus.RUNNING, startedAt: now },
      });

      const followupWaitDue = await this.prisma.campaignRecipient.findMany({
        where: {
          status: CampaignRecipientStatus.QUEUED,
          followupPhase: FU_PHASE_WAIT,
          nextFollowupSendAt: { lte: now },
          campaign: { is: { status: CampaignStatus.RUNNING, deletedAt: null } },
        },
        include: { campaign: true, emailListItem: true },
        take: 25,
        orderBy: [{ nextFollowupSendAt: { sort: 'asc', nulls: 'last' } }],
      });
      for (const rec of followupWaitDue) {
        try {
          await this.advanceFollowupWaitIfDue(rec);
        } catch (e) {
          this.log.error(`followup_wait ${rec.id}`, e);
        }
      }

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
          data: { nextSendAt: null, nextMainSendAt: null },
        });
      }

      const due = await this.prisma.campaignRecipient.findMany({
        where: {
          status: CampaignRecipientStatus.QUEUED,
          OR: [
            {
              AND: [
                { nextMainSendAt: { not: null } },
                { nextMainSendAt: { lte: now } },
              ],
            },
            {
              AND: [
                { followupPhase: FU_PHASE_ACTIVE },
                {
                  OR: [{ nextFollowupSendAt: null }, { nextFollowupSendAt: { lte: now } }],
                },
              ],
            },
          ],
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

  private async revertRecipientToQueued(
    recId: string,
    patch: { nextMainSendAt?: Date | null; nextFollowupSendAt?: Date | null; nextSendAt?: Date | null },
  ) {
    const row = await this.prisma.campaignRecipient.findUnique({
      where: { id: recId },
      select: {
        nextMainSendAt: true,
        nextFollowupSendAt: true,
        followupPhase: true,
      },
    });
    if (!row) return;
    const nm = patch.nextMainSendAt !== undefined ? patch.nextMainSendAt : row.nextMainSendAt;
    const nf = patch.nextFollowupSendAt !== undefined ? patch.nextFollowupSendAt : row.nextFollowupSendAt;
    const mir =
      patch.nextSendAt !== undefined
        ? patch.nextSendAt
        : computeMirroredNextSendAt({
            nextMainSendAt: nm,
            nextFollowupSendAt: nf,
            followupPhase: row.followupPhase,
          });
    await this.prisma.campaignRecipient.updateMany({
      where: { id: recId, status: CampaignRecipientStatus.ACTIVE },
      data: {
        status: CampaignRecipientStatus.QUEUED,
        ...(patch.nextMainSendAt !== undefined ? { nextMainSendAt: patch.nextMainSendAt } : {}),
        ...(patch.nextFollowupSendAt !== undefined ? { nextFollowupSendAt: patch.nextFollowupSendAt } : {}),
        nextSendAt: mir,
      },
    });
  }

  private async releaseActiveWithDeferBoth(recId: string, camp: { senderAccountIds: unknown; userId: string }) {
    const deferUntil = await this.computeDeferUntil(
      parseSenderAccountIds(camp.senderAccountIds),
      camp.userId,
    );
    const now = Date.now();
    const row = await this.prisma.campaignRecipient.findUnique({
      where: { id: recId },
      select: { nextMainSendAt: true, nextFollowupSendAt: true, followupPhase: true },
    });
    if (!row) return;
    const mainWasDue =
      row.nextMainSendAt != null && row.nextMainSendAt.getTime() <= now;
    const fuWasDue =
      row.followupPhase === FU_PHASE_ACTIVE &&
      (row.nextFollowupSendAt == null || row.nextFollowupSendAt.getTime() <= now);
    const nm = mainWasDue ? deferUntil : row.nextMainSendAt;
    const nf = fuWasDue ? deferUntil : row.nextFollowupSendAt;
    await this.prisma.campaignRecipient.updateMany({
      where: { id: recId, status: CampaignRecipientStatus.ACTIVE },
      data: {
        status: CampaignRecipientStatus.QUEUED,
        nextMainSendAt: nm,
        nextFollowupSendAt: nf,
        nextSendAt: computeMirroredNextSendAt({
          nextMainSendAt: nm,
          nextFollowupSendAt: nf,
          followupPhase: row.followupPhase,
        }),
      },
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
    const mainDue =
      rec.nextMainSendAt != null && (rec.nextMainSendAt as Date).getTime() <= now.getTime();
    const followupSendDue =
      rec.followupPhase === FU_PHASE_ACTIVE &&
      (rec.nextFollowupSendAt == null || (rec.nextFollowupSendAt as Date).getTime() <= now.getTime());

    const claimed = await this.prisma.campaignRecipient.updateMany({
      where: {
        id: rec.id,
        status: CampaignRecipientStatus.QUEUED,
        OR: [
          {
            AND: [
              { nextMainSendAt: { not: null } },
              { nextMainSendAt: { lte: now } },
            ],
          },
          {
            AND: [
              { followupPhase: FU_PHASE_ACTIVE },
              {
                OR: [{ nextFollowupSendAt: null }, { nextFollowupSendAt: { lte: now } }],
              },
            ],
          },
        ],
      },
      data: { status: CampaignRecipientStatus.ACTIVE },
    });
    if (claimed.count === 0) return;

    const deferAccounts = async () =>
      this.computeDeferUntil(parseSenderAccountIds(camp.senderAccountIds), camp.userId);

    try {
      if (mainDue && followupSendDue) {
        const prio = camp.sendConflictPriority ?? SendConflictPriority.MAIN_FIRST;
        const order: SendTrack[] =
          prio === SendConflictPriority.FOLLOWUP_FIRST ? ['followup', 'main'] : ['main', 'followup'];
        for (const track of order) {
          const outcome = await this.processSendForTrack(rec, camp, track);
          if (outcome === 'done') return;
        }
        await this.releaseActiveWithDeferBoth(rec.id, camp);
        return;
      }
      if (mainDue) {
        const outcome = await this.processSendForTrack(rec, camp, 'main');
        if (outcome === 'done') return;
        await this.revertRecipientToQueued(rec.id, { nextMainSendAt: await deferAccounts() });
        return;
      }
      if (followupSendDue) {
        const outcome = await this.processSendForTrack(rec, camp, 'followup');
        if (outcome === 'done') return;
        await this.revertRecipientToQueued(rec.id, { nextFollowupSendAt: await deferAccounts() });
      }
    } catch (e) {
      await this.revertRecipientToQueued(rec.id, {});
      throw e;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma recipient + joined campaign JSON
  private async processSendForTrack(rec: any, camp: any, track: SendTrack): Promise<'done' | 'defer'> {
    const suppressed = await this.prisma.emailSuppression.findUnique({
      where: {
        userId_emailNorm: { userId: camp.userId, emailNorm: rec.targetEmail.toLowerCase() },
      },
    });
    if (suppressed) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status: CampaignRecipientStatus.UNSUBSCRIBED,
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
          followupPhase: FU_PHASE_DONE,
        },
      });
      return 'done';
    }

    if (rec.replied === true) {
      if (camp.stopCampaignOnCompanyReply === true) {
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            status: CampaignRecipientStatus.COMPLETED,
            nextSendAt: null,
            nextMainSendAt: null,
            nextFollowupSendAt: null,
            followupPhase: FU_PHASE_DONE,
          },
        });
        await this.markCampaignCompletedIfIdle(camp.id);
        return 'done';
      }
      if (
        camp.stopFollowUpsOnReply === true &&
        track === 'followup' &&
        rec.followupPhase !== FU_PHASE_IDLE &&
        rec.followupPhase !== FU_PHASE_DONE
      ) {
        const row = await this.prisma.campaignRecipient.findUnique({
          where: { id: rec.id },
          select: { nextMainSendAt: true },
        });
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            followupPhase: FU_PHASE_DONE,
            nextFollowupSendAt: null,
            nextSendAt: computeMirroredNextSendAt({
              nextMainSendAt: row?.nextMainSendAt ?? null,
              nextFollowupSendAt: null,
              followupPhase: FU_PHASE_DONE,
            }),
          },
        });
        await this.maybeMarkRecipientComplete(rec.id, camp.id);
        return 'defer';
      }
    }

    const senderIds = parseSenderAccountIds(camp.senderAccountIds);
    if (!senderIds.length) {
      this.log.warn(`Campaign ${camp.id}: recipient ${rec.id} skipped — no sender accounts on campaign.`);
      return 'defer';
    }

    const followV2 = getFollowUpV2(camp);
    const mainChain: ChainStep[] = resolveMainChainFromCampaign(camp);

    const followChain: ChainStep[] =
      track === 'followup'
        ? followV2
          ? (() => {
              const b = rec.followBranch === 'yes' ? 'yes' : 'no';
              return (b === 'yes' ? followV2.yesChain : followV2.noChain).filter((x) => x?.templateId);
            })()
          : ((camp.followUpSequence as unknown as ChainStep[]) ?? []).filter((x) => x?.templateId)
        : [];

    const chain = track === 'main' ? mainChain : followChain;
    const stepIndex = track === 'main' ? rec.mainStepIndex : rec.followupStepIndex;
    const step = chain[stepIndex];
    if (!step?.templateId) {
      if (track === 'main') {
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            status: CampaignRecipientStatus.COMPLETED,
            nextSendAt: null,
            nextMainSendAt: null,
            nextFollowupSendAt: null,
            followupPhase: FU_PHASE_DONE,
          },
        });
        await this.markCampaignCompletedIfIdle(camp.id);
        return 'done';
      }
      await this.finalizeFollowupTrackDone(rec.id, camp.id);
      return 'done';
    }

    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: step.templateId, userId: camp.userId, deletedAt: null },
    });
    if (!template) {
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status: CampaignRecipientStatus.FAILED,
          failReason: 'Template missing',
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
        },
      });
      return 'done';
    }

    const acc = await this.pickEligibleSenderAccount(senderIds, camp.userId);
    if (!acc) return 'defer';

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
      return 'defer';
    }

    let smtpPass: string | null = null;
    if (canSmtp) {
      smtpPass = await this.accounts.getDecryptedPassword(acc.id);
      if (!smtpPass) {
        this.log.warn(`Campaign ${camp.id}: SMTP password missing for account ${acc.id}.`);
        return 'defer';
      }
    }

    const dayStart = this.dayStartLocal();
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
        await this.prisma.campaignRecipient.updateMany({
          where: { id: rec.id, status: CampaignRecipientStatus.ACTIVE },
          data: {
            status: CampaignRecipientStatus.QUEUED,
            ...(track === 'main' ? { nextMainSendAt: nextDay } : { nextFollowupSendAt: nextDay }),
          },
        });
        const fresh = await this.prisma.campaignRecipient.findUnique({
          where: { id: rec.id },
          select: { nextMainSendAt: true, nextFollowupSendAt: true, followupPhase: true },
        });
        await this.prisma.campaignRecipient.updateMany({
          where: { id: rec.id },
          data: {
            nextSendAt: computeMirroredNextSendAt({
              nextMainSendAt: fresh?.nextMainSendAt ?? null,
              nextFollowupSendAt: fresh?.nextFollowupSendAt ?? null,
              followupPhase: fresh?.followupPhase ?? FU_PHASE_IDLE,
            }),
          },
        });
        return 'done';
      }
    }

    if (/localhost|127\.0\.0\.1/i.test(API_PUBLIC)) {
      this.log.warn(
        `API_PUBLIC_URL is "${API_PUBLIC}". Opens/unsubscribes will NOT track for real recipients.`,
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
        return 'defer';
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Send failed';
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          status: CampaignRecipientStatus.FAILED,
          failReason: msg.slice(0, 240),
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
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
        // best-effort
      }
      this.log.warn(`Campaign ${camp.id}: send failed for recipient ${rec.id} via account ${acc.id}: ${msg}`);
      await this.markCampaignCompletedIfIdle(camp.id);
      return 'done';
    }

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

    const sentAt = new Date();
    if (track === 'main') {
      await this.applyAfterMainSend(rec, camp, mainChain, followV2, sentAt, jitterMs, step);
    } else {
      await this.applyAfterFollowupSend(rec, followChain, sentAt, jitterMs, step);
    }

    return 'done';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyAfterFollowupSend(rec: any, chain: ChainStep[], sentAt: Date, jitterMs: number, step: ChainStep) {
    const nextFuIdx = rec.followupStepIndex + 1;
    const delayDays = step.delayDaysBeforeNext ?? 0;
    const base = Date.now() + delayDays * 86400000 + jitterMs;

    if (nextFuIdx >= chain.length) {
      const row = await this.prisma.campaignRecipient.findUnique({
        where: { id: rec.id },
        select: { nextMainSendAt: true },
      });
      const nextMir = computeMirroredNextSendAt({
        nextMainSendAt: row?.nextMainSendAt ?? null,
        nextFollowupSendAt: null,
        followupPhase: FU_PHASE_DONE,
      });
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          followupPhase: FU_PHASE_DONE,
          nextFollowupSendAt: null,
          lastSentAt: sentAt,
          status: CampaignRecipientStatus.QUEUED,
          nextSendAt: nextMir,
        },
      });
      await this.maybeMarkRecipientComplete(rec.id, rec.campaignId);
      return;
    }

    const nextFollow = new Date(base);
    const row = await this.prisma.campaignRecipient.findUnique({
      where: { id: rec.id },
      select: { nextMainSendAt: true, followupPhase: true },
    });
    const nextMir = computeMirroredNextSendAt({
      nextMainSendAt: row?.nextMainSendAt ?? null,
      nextFollowupSendAt: nextFollow,
      followupPhase: FU_PHASE_ACTIVE,
    });
    await this.prisma.campaignRecipient.update({
      where: { id: rec.id },
      data: {
        followupStepIndex: nextFuIdx,
        stepIndex: nextFuIdx,
        nextFollowupSendAt: nextFollow,
        lastSentAt: sentAt,
        status: CampaignRecipientStatus.QUEUED,
        nextSendAt: nextMir,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyAfterMainSend(
    rec: any,
    camp: any,
    mainChain: ChainStep[],
    followV2: ReturnType<typeof getFollowUpV2>,
    sentAt: Date,
    jitterMs: number,
    step: ChainStep,
  ) {
    const nextIdx = rec.mainStepIndex + 1;
    const delayDays = step.delayDaysBeforeNext ?? 0;
    const base = Date.now() + delayDays * 86400000 + jitterMs;

    const thisSendIsFollowupAnchor =
      !!followV2 && rec.mainStepIndex === followV2.afterEmailIndex;
    const anchorForWait = thisSendIsFollowupAnchor
      ? sentAt
      : ((rec.followupAnchorSentAt as Date | null) ?? sentAt);

    let followPatch: Record<string, unknown> = {};
    if (thisSendIsFollowupAnchor && followV2 && rec.followupPhase === FU_PHASE_IDLE) {
      const waitUntil = this.addDays(anchorForWait, Math.max(1, followV2.waitDays));
      followPatch = {
        followupPhase: FU_PHASE_WAIT,
        nextFollowupSendAt: waitUntil,
        followupAnchorSentAt: anchorForWait,
      };
    }

    if (nextIdx >= mainChain.length) {
      const nextMainAt: Date | null = null;
      const mergedPhase = ((followPatch.followupPhase as string) ?? rec.followupPhase) as string;
      const mergedFuNext = ((followPatch.nextFollowupSendAt as Date | undefined) ??
        rec.nextFollowupSendAt) as Date | null;
      let nextMir = computeMirroredNextSendAt({
        nextMainSendAt: nextMainAt,
        nextFollowupSendAt: mergedFuNext,
        followupPhase: mergedPhase,
      });
      await this.prisma.campaignRecipient.update({
        where: { id: rec.id },
        data: {
          mainStepIndex: rec.mainStepIndex,
          stepIndex: rec.mainStepIndex,
          nextMainSendAt: null,
          phase: 'main',
          lastSentAt: sentAt,
          status: CampaignRecipientStatus.QUEUED,
          nextSendAt: nextMir,
          ...followPatch,
        },
      });
      const legacyFu = ((camp.followUpSequence as unknown as ChainStep[]) ?? []).filter((x) => x?.templateId);
      if (!followV2 && legacyFu.length) {
        const nextLegacy = new Date(base);
        const r2 = await this.prisma.campaignRecipient.findUnique({
          where: { id: rec.id },
          select: { nextMainSendAt: true, followupPhase: true, nextFollowupSendAt: true },
        });
        nextMir = computeMirroredNextSendAt({
          nextMainSendAt: r2?.nextMainSendAt ?? null,
          nextFollowupSendAt: nextLegacy,
          followupPhase: FU_PHASE_ACTIVE,
        });
        await this.prisma.campaignRecipient.update({
          where: { id: rec.id },
          data: {
            phase: 'followup',
            followupPhase: FU_PHASE_ACTIVE,
            followupStepIndex: 0,
            stepIndex: 0,
            nextFollowupSendAt: nextLegacy,
            nextSendAt: nextMir,
          },
        });
      }
      await this.maybeMarkRecipientComplete(rec.id, camp.id);
      return;
    }

    const nextMainAt = new Date(base);
    const mergedPhase = ((followPatch.followupPhase as string) ?? rec.followupPhase) as string;
    const mergedFuNext = ((followPatch.nextFollowupSendAt as Date | undefined) ??
      rec.nextFollowupSendAt) as Date | null;
    const nextMir = computeMirroredNextSendAt({
      nextMainSendAt: nextMainAt,
      nextFollowupSendAt: mergedFuNext,
      followupPhase: mergedPhase,
    });
    await this.prisma.campaignRecipient.update({
      where: { id: rec.id },
      data: {
        mainStepIndex: nextIdx,
        stepIndex: nextIdx,
        nextMainSendAt: nextMainAt,
        phase: 'main',
        lastSentAt: sentAt,
        status: CampaignRecipientStatus.QUEUED,
        nextSendAt: nextMir,
        ...followPatch,
      },
    });
  }

  private async finalizeFollowupTrackDone(recipientId: string, campaignId: string) {
    const row = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      select: { nextMainSendAt: true },
    });
    await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        followupPhase: FU_PHASE_DONE,
        nextFollowupSendAt: null,
        nextSendAt: computeMirroredNextSendAt({
          nextMainSendAt: row?.nextMainSendAt ?? null,
          nextFollowupSendAt: null,
          followupPhase: FU_PHASE_DONE,
        }),
        status:
          row?.nextMainSendAt == null ? CampaignRecipientStatus.COMPLETED : CampaignRecipientStatus.QUEUED,
      },
    });
    await this.maybeMarkRecipientComplete(recipientId, campaignId);
  }

  private async maybeMarkRecipientComplete(recipientId: string, campaignId: string) {
    const r = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      select: {
        status: true,
        nextMainSendAt: true,
        followupPhase: true,
      },
    });
    if (!r || r.status !== CampaignRecipientStatus.QUEUED) return;
    const followV2 = await this.prisma.campaign
      .findUnique({ where: { id: campaignId }, select: { followUpStartRule: true } })
      .then((c) => getFollowUpV2(c ?? {}));
    const mainDone = r.nextMainSendAt == null;
    const fuDone =
      !followV2 ||
      r.followupPhase === FU_PHASE_DONE ||
      (Boolean(followV2) && mainDone && r.followupPhase === FU_PHASE_IDLE);
    if (mainDone && fuDone) {
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: CampaignRecipientStatus.COMPLETED,
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
        },
      });
      await this.markCampaignCompletedIfIdle(campaignId);
    }
  }

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
