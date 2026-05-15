import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CampaignStatus, SubscriptionTier } from '@prisma/client';
import { normalizeSiteUrl } from '@leadgenor/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLAN_PRICE_USD,
  PAYMENT_CONTACT_DISPLAY,
  resolvedLimits,
} from './subscription.constants';

export function ymUtc(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBoundsUtc(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  effectiveFromUser(u: {
    subscriptionTier: SubscriptionTier;
    subscriptionEndsAt: Date | null;
  }): SubscriptionTier {
    const now = Date.now();
    const ends = u.subscriptionEndsAt?.getTime();
    if (u.subscriptionTier === SubscriptionTier.BUSINESS) {
      return ends == null || ends > now ? SubscriptionTier.BUSINESS : SubscriptionTier.FREE;
    }
    if (u.subscriptionTier === SubscriptionTier.PRO) {
      return ends == null || ends > now ? SubscriptionTier.PRO : SubscriptionTier.FREE;
    }
    return SubscriptionTier.FREE;
  }

  async effectiveTier(userId: string): Promise<SubscriptionTier> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionEndsAt: true },
    });
    if (!u) return SubscriptionTier.FREE;
    return this.effectiveFromUser(u);
  }

  async getLimits(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionEndsAt: true },
    });
    const eff = this.effectiveFromUser(u);
    return resolvedLimits(u.subscriptionTier, eff);
  }

  async countEmailsSentThisUtcMonth(userId: string, ym: string): Promise<number> {
    const { start, end } = monthBoundsUtc(ym);
    return this.prisma.campaignSendLog.count({
      where: { userId, sentAt: { gte: start, lt: end } },
    });
  }

  async assertAndConsumeNewList(userId: string, tx: Prisma.TransactionClient) {
    const ym = ymUtc();
    const eff = await this.effectiveTier(userId);
    const stored = (
      await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionTier: true } })
    ).subscriptionTier;
    const lim = resolvedLimits(stored, eff).listsPerMonth;
    if (lim == null) return;
    const row = await tx.subscriptionUsageMonth.findUnique({
      where: { userId_ym: { userId, ym } },
    });
    const cur = row?.listsCreatedCount ?? 0;
    if (cur >= lim) {
      throw new ForbiddenException('Apni is month ki lists add karne ki free limit khatam ho chuki hai.');
    }
    await tx.subscriptionUsageMonth.upsert({
      where: { userId_ym: { userId, ym } },
      create: { userId, ym, listsCreatedCount: 1 },
      update: { listsCreatedCount: { increment: 1 } },
    });
  }

  async assertAndConsumeNewCampaignDraft(userId: string, tx: Prisma.TransactionClient) {
    const ym = ymUtc();
    const eff = await this.effectiveTier(userId);
    const stored = (
      await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionTier: true } })
    ).subscriptionTier;
    const lim = resolvedLimits(stored, eff).campaignsDraftsPerMonth;
    if (lim == null) return;
    const row = await tx.subscriptionUsageMonth.findUnique({
      where: { userId_ym: { userId, ym } },
    });
    const cur = row?.campaignsCreatedCount ?? 0;
    if (cur >= lim) {
      throw new ForbiddenException(
        `Free plan allows ${lim} new campaign per month. Wait until next month or upgrade.`,
      );
    }
    await tx.subscriptionUsageMonth.upsert({
      where: { userId_ym: { userId, ym } },
      create: { userId, ym, campaignsCreatedCount: 1 },
      update: { campaignsCreatedCount: { increment: 1 } },
    });
  }

  /** Must run in the same transaction as list item inserts. */
  async assertConsumeProspectsAdded(tx: Prisma.TransactionClient, userId: string, added: number) {
    if (added <= 0) return;
    const eff = await this.effectiveTier(userId);
    const stored = (
      await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionTier: true } })
    ).subscriptionTier;
    const lim = resolvedLimits(stored, eff).prospectsAddedPerMonth;
    if (lim == null) return;
    const ym = ymUtc();
    const row = await tx.subscriptionUsageMonth.findUnique({
      where: { userId_ym: { userId, ym } },
    });
    const cur = row?.prospectsAddedCount ?? 0;
    if (cur + added > lim) {
      throw new ForbiddenException(
        `Free plan allows ${lim} new prospects added to lists per month (${cur} already added this month).`,
      );
    }
    await tx.subscriptionUsageMonth.upsert({
      where: { userId_ym: { userId, ym } },
      create: { userId, ym, prospectsAddedCount: added },
      update: { prospectsAddedCount: { increment: added } },
    });
  }

  async assertFolderTemplateCountsForCreateFolder(userId: string) {
    const lim = await this.getLimits(userId);
    if (lim.foldersMax == null) return;
    const n = await this.prisma.templateFolder.count({ where: { userId, deletedAt: null } });
    if (n >= lim.foldersMax) {
      throw new ForbiddenException(
        `Your plan allows ${lim.foldersMax} template folder(s). Upgrade to add more.`,
      );
    }
  }

  async assertTemplateCount(userId: string) {
    const lim = await this.getLimits(userId);
    if (lim.templatesMax == null) return;
    const n = await this.prisma.emailTemplate.count({ where: { userId, deletedAt: null } });
    if (n >= lim.templatesMax) {
      throw new ForbiddenException(
        `Your plan allows ${lim.templatesMax} email template(s). Upgrade to add more.`,
      );
    }
  }

  async assertEmailAccountSlot(userId: string) {
    const lim = await this.getLimits(userId);
    if (lim.emailAccountsMax == null) return;
    const n = await this.prisma.emailAccount.count({ where: { userId, deletedAt: null } });
    if (n >= lim.emailAccountsMax) {
      throw new ForbiddenException(
        `Your plan allows ${lim.emailAccountsMax} email account(s). Upgrade to add more.`,
      );
    }
  }

  async assertCampaignListRecipientCap(userId: string, emailListId: string) {
    const lim = await this.getLimits(userId);
    if (lim.maxRecipientsPerCampaignList == null) return;
    const cnt = await this.prisma.emailListItem.count({ where: { listId: emailListId } });
    if (cnt > lim.maxRecipientsPerCampaignList) {
      throw new BadRequestException(
        `This list has ${cnt} prospects. Your plan allows at most ${lim.maxRecipientsPerCampaignList} prospects per campaign list.`,
      );
    }
  }

  /** Validate JSON sequences for free tiers (caller merges campaign + patch first). */
    assertCampaignSequences(
    effTier: SubscriptionTier,
    merged: {
      senderAccountIds: unknown;
      mainSequence?: unknown;
      followUpSequence?: unknown;
      mainFlowGraph?: unknown;
    },
  ) {
    const lim = resolvedLimits(SubscriptionTier.FREE, effTier);
    if (lim.sendersPerCampaign == null && lim.mainSeqStepsMax == null) return;

    const senderIds =
      typeof merged.senderAccountIds === 'string'
        ? (JSON.parse(merged.senderAccountIds) as string[])
        : Array.isArray(merged.senderAccountIds)
          ? (merged.senderAccountIds as string[])
          : [];

    const ids = senderIds.filter((x) => typeof x === 'string' && x.length > 0);
    if (lim.sendersPerCampaign != null && ids.length > lim.sendersPerCampaign) {
      throw new BadRequestException(
        `Your plan allows ${lim.sendersPerCampaign} sender account(s) on a campaign.`,
      );
    }

    if (lim.mainSeqStepsMax == null && lim.followUpSeqStepsMax == null) return;

    const mainArr = merged.mainSequence as { templateId?: string }[] | undefined;
    const mainFromSeq = Array.isArray(mainArr)
      ? mainArr.filter((s) => s?.templateId && String(s.templateId).trim()).length
      : 0;
    let mainSteps = mainFromSeq;
    if (!mainSteps && merged.mainFlowGraph) {
      try {
        type Node = Record<string, unknown>;
        const countEmail = (nodes: unknown): number => {
          if (!Array.isArray(nodes)) return 0;
          let c = 0;
          for (const raw of nodes) {
            const n = raw as Node;
            if (!n || typeof n !== 'object') continue;
            if (n.t === 'email' && String(n.templateId ?? '').trim()) c++;
            if (n.t === 'condition') {
              c += countEmail(n.yes) + countEmail(n.no);
            }
          }
          return c;
        };
        mainSteps = countEmail(merged.mainFlowGraph);
      } catch {
        mainSteps = 0;
      }
    }

    const fu = merged.followUpSequence as { templateId?: string }[] | undefined;
    const fuSteps = Array.isArray(fu)
      ? fu.filter((s) => s?.templateId && String(s.templateId).trim()).length
      : 0;

    if (lim.mainSeqStepsMax != null && mainSteps > lim.mainSeqStepsMax) {
      throw new BadRequestException(
        `Your plan allows ${lim.mainSeqStepsMax} email step(s) in the main sequence.`,
      );
    }
    if (lim.followUpSeqStepsMax != null && fuSteps > lim.followUpSeqStepsMax) {
      throw new BadRequestException(
        `Your plan allows ${lim.followUpSeqStepsMax} follow-up email step(s).`,
      );
    }
  }

  async assertMailboxSyncBudget(userId: string) {
    const lim = await this.getLimits(userId);
    if (lim.mailboxSyncsPerMonth == null) return;
    const ym = ymUtc();
    const row = await this.prisma.mailboxSyncUsage.findUnique({
      where: { userId_ym: { userId, ym } },
    });
    const used = row?.count ?? 0;
    if (used >= lim.mailboxSyncsPerMonth) {
      throw new ForbiddenException(
        `Monthly mailbox sync limit reached (${lim.mailboxSyncsPerMonth}). Upgrade or wait until next month.`,
      );
    }
  }

  async recordMailboxSynced(userId: string) {
    const lim = await this.getLimits(userId);
    if (lim.mailboxSyncsPerMonth == null) return;
    const ym = ymUtc();
    await this.prisma.mailboxSyncUsage.upsert({
      where: { userId_ym: { userId, ym } },
      create: { userId, ym, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  /** Reserve finder URLs for this month (unique normalized sites). Throws if quota exceeded. */
  async assertAndReserveFinderUrls(userId: string, rawUrls: string[]) {
    const eff = await this.effectiveTier(userId);
    const stored = (
      await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionTier: true } })
    ).subscriptionTier;
    const lim = resolvedLimits(stored, eff).finderUrlsPerMonth;
    if (lim == null) return;

    const ym = ymUtc();
    const norms = Array.from(
      new Set(rawUrls.map((u) => normalizeSiteUrl(u)).filter(Boolean)),
    ).slice(0, 500);
    if (!norms.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const urlNorm of norms) {
        try {
          await tx.emailFinderUsageUrl.create({
            data: { userId, ym, urlNorm },
          });
        } catch {
          // duplicate = already billed this URL this month
        }
      }
      const used = await tx.emailFinderUsageUrl.count({ where: { userId, ym } });
      if (used > lim) {
        throw new ForbiddenException(
          `Email finder quota for your plan is ${lim} unique site(s) per month (${used} used after this batch). Upgrade or wait until next month.`,
        );
      }
    });
  }

  /** Pause RUNNING/SCHEDULED campaigns when monthly send quota is exhausted. */
  async enforceMonthlyEmailSendBudget(userId: string): Promise<void> {
    const eff = await this.effectiveTier(userId);
    const stored = (
      await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionTier: true } })
    ).subscriptionTier;
    const lim = resolvedLimits(stored, eff).emailsSentPerMonth;
    if (lim == null) return;
    const ym = ymUtc();
    const sent = await this.countEmailsSentThisUtcMonth(userId, ym);
    if (sent < lim) return;
    const reason =
      eff === SubscriptionTier.FREE
        ? 'Monthly free email send limit reached. Wait until next month or upgrade.'
        : 'Monthly Pro email send limit reached. Upgrade to Business for unlimited.';
    await this.prisma.campaign.updateMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] },
      },
      data: { status: CampaignStatus.PAUSED, pauseReason: reason },
    });
  }

  plansCatalog() {
    return {
      whatsappInstruction: PAYMENT_CONTACT_DISPLAY,
      plans: [
        {
          tier: SubscriptionTier.FREE,
          title: 'Free',
          summary: 'Vendors/clients/orders unlimited; capped email marketing tooling.',
          priceUsd: null,
        },
        {
          tier: SubscriptionTier.PRO,
          title: 'Pro',
          summary: 'Higher limits for lists, sends, finder, templates, accounts.',
          priceUsd: PLAN_PRICE_USD.PRO,
        },
        {
          tier: SubscriptionTier.BUSINESS,
          title: 'Business',
          summary: 'Unlimited email-marketing quotas.',
          priceUsd: PLAN_PRICE_USD.BUSINESS,
        },
      ],
    };
  }

  async mergeDashboardState(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        subscriptionEndsAt: true,
        planChosenAt: true,
      },
    });
    const eff = this.effectiveFromUser(u);
    const lim = resolvedLimits(u.subscriptionTier, eff);
    const ym = ymUtc();
    const usage = await this.prisma.subscriptionUsageMonth.findUnique({
      where: { userId_ym: { userId, ym } },
    });
    const sends = await this.countEmailsSentThisUtcMonth(userId, ym);
    const finderUsed = await this.prisma.emailFinderUsageUrl.count({ where: { userId, ym } });
    const syncRow = await this.prisma.mailboxSyncUsage.findUnique({
      where: { userId_ym: { userId, ym } },
    });

    const emailsBudget = lim.emailsSentPerMonth;
    return {
      storedTier: u.subscriptionTier,
      effectiveTier: eff,
      subscriptionEndsAt: u.subscriptionEndsAt,
      planChosenAt: u.planChosenAt,
      ymUtc: ym,
      engagementStats: lim.engagementStats,
      limits: {
        listsCreatedThisMonthMax: lim.listsPerMonth,
        prospectsAddedThisMonthMax: lim.prospectsAddedPerMonth,
        campaignDraftsThisMonthMax: lim.campaignsDraftsPerMonth,
        emailsSentThisMonthMax: emailsBudget,
        finderUrlsThisMonthMax: lim.finderUrlsPerMonth,
        mailboxSyncThisMonthMax: lim.mailboxSyncsPerMonth,
        emailAccountsMax: lim.emailAccountsMax,
        foldersMax: lim.foldersMax,
        templatesMax: lim.templatesMax,
        campaignSendersMax: lim.sendersPerCampaign,
      },
      usage: {
        listsCreatedThisMonth: usage?.listsCreatedCount ?? 0,
        prospectsAddedThisMonth: usage?.prospectsAddedCount ?? 0,
        campaignDraftsThisMonth: usage?.campaignsCreatedCount ?? 0,
        emailsSentThisMonth: sends,
        finderUrlsUsedThisMonth: finderUsed,
        mailboxSyncThisMonth: syncRow?.count ?? 0,
      },
      banners: {
        monthlyEmailsExhausted: emailsBudget != null && sends >= emailsBudget,
        nearMonthlyEmailCap:
          emailsBudget != null ? sends >= Math.max(0, emailsBudget - 10) : false,
      },
    };
  }
}
