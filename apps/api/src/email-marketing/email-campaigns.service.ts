import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignRecipientStatus,
  CampaignStatus,
  EmailListAutoUpdate,
  EmailRiskLevel,
  MissingVariablePolicy,
  MultiEmailPolicy,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  campaignProspectEmailRejection,
  prospectEmailCellsFromImport,
} from '../common/campaign-prospect-email';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { resolveMainChainFromCampaign, type ChainStep } from './compile-main-flow';
import { applyMergeTemplate, buildMergeVars, missingMergeVars } from './merge-tags';
import {
  INLINE_UNSUBSCRIBE_HREF,
  bodyHasInlineUnsubscribe,
  expandLgUnsubTokensToAnchor,
} from './inline-unsub-placeholder';

export type { ChainStep } from './compile-main-flow';

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
export class EmailCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionService,
    private readonly notifications: NotificationsService,
  ) {}

  async completedReports(userId: string) {
    const limEngagement = await this.subscription.getLimits(userId);
    const campaigns = await this.prisma.campaign.findMany({
      where: { userId, deletedAt: null, status: CampaignStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        name: true,
        completedAt: true,
        createdAt: true,
        emailList: { select: { id: true, name: true } },
      },
    });
    const ids = campaigns.map((c) => c.id);
    if (!ids.length) return [];

    const [prospectCounts, sentCounts, byAccount] = await Promise.all([
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids }, lastSentAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.campaignSendLog.groupBy({
        by: ['campaignId', 'emailAccountId'],
        where: { userId, campaignId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const prospectsByCampaign = new Map(prospectCounts.map((g) => [g.campaignId, g._count._all]));
    const sentByCampaign = new Map(sentCounts.map((g) => [g.campaignId, g._count._all]));

    const allAccountIds = Array.from(new Set(byAccount.map((g) => g.emailAccountId)));
    const accounts =
      allAccountIds.length > 0
        ? await this.prisma.emailAccount.findMany({
            where: { userId, id: { in: allAccountIds }, deletedAt: null },
            select: { id: true, fromEmail: true, displayName: true },
          })
        : [];
    const accById = new Map(accounts.map((a) => [a.id, a]));

    const accountsByCampaign = new Map<
      string,
      { emailAccountId: string; fromEmail: string; displayName: string; sentEmails: number }[]
    >();
    for (const row of byAccount) {
      const cid = row.campaignId;
      const aid = row.emailAccountId;
      const acc = accById.get(aid);
      if (!acc) continue;
      const list = accountsByCampaign.get(cid) ?? [];
      list.push({
        emailAccountId: aid,
        fromEmail: acc.fromEmail,
        displayName: acc.displayName,
        sentEmails: row._count._all,
      });
      accountsByCampaign.set(cid, list);
    }
    for (const [cid, list] of accountsByCampaign) {
      list.sort((a, b) => b.sentEmails - a.sentEmails);
      accountsByCampaign.set(cid, list);
    }

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      completedAt: c.completedAt ?? null,
      emailList: c.emailList,
      prospects: prospectsByCampaign.get(c.id) ?? 0,
      totalSentEmails: sentByCampaign.get(c.id) ?? 0,
      byAccount: accountsByCampaign.get(c.id) ?? [],
      engagementStats: limEngagement.engagementStats,
    }));
  }

  async sendReports(userId: string, statuses: CampaignStatus[] = [CampaignStatus.RUNNING, CampaignStatus.COMPLETED]) {
    const limEngagement = await this.subscription.getLimits(userId);
    const campaigns = await this.prisma.campaign.findMany({
      where: { userId, deletedAt: null, status: { in: statuses } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        emailList: { select: { id: true, name: true } },
      },
    });
    const ids = campaigns.map((c) => c.id);
    if (!ids.length) return [];

    const [sentCounts, byAccount] = await Promise.all([
      this.prisma.campaignSendLog.groupBy({
        by: ['campaignId'],
        where: { userId, campaignId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.campaignSendLog.groupBy({
        by: ['campaignId', 'emailAccountId'],
        where: { userId, campaignId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const sentByCampaign = new Map(sentCounts.map((g) => [g.campaignId, g._count._all]));

    const allAccountIds = Array.from(new Set(byAccount.map((g) => g.emailAccountId)));
    const accounts =
      allAccountIds.length > 0
        ? await this.prisma.emailAccount.findMany({
            where: { userId, id: { in: allAccountIds }, deletedAt: null },
            select: { id: true, fromEmail: true, displayName: true },
          })
        : [];
    const accById = new Map(accounts.map((a) => [a.id, a]));

    const accountsByCampaign = new Map<
      string,
      { emailAccountId: string; fromEmail: string; displayName: string; sentEmails: number }[]
    >();
    for (const row of byAccount) {
      const cid = row.campaignId;
      const aid = row.emailAccountId;
      const acc = accById.get(aid);
      if (!acc) continue;
      const list = accountsByCampaign.get(cid) ?? [];
      list.push({
        emailAccountId: aid,
        fromEmail: acc.fromEmail,
        displayName: acc.displayName,
        sentEmails: row._count._all,
      });
      accountsByCampaign.set(cid, list);
    }
    for (const [cid, list] of accountsByCampaign) {
      list.sort((a, b) => b.sentEmails - a.sentEmails);
      accountsByCampaign.set(cid, list);
    }

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      startedAt: c.startedAt ?? null,
      completedAt: c.completedAt ?? null,
      emailList: c.emailList,
      totalSentEmails: sentByCampaign.get(c.id) ?? 0,
      byAccount: accountsByCampaign.get(c.id) ?? [],
      engagementStats: limEngagement.engagementStats,
    }));
  }

  async sendReportAccountDrilldown(
    userId: string,
    campaignId: string,
    emailAccountId: string,
    take = 200,
  ) {
    const camp = await this.prisma.campaign.findFirst({
      where: { id: campaignId, userId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!camp) throw new NotFoundException('Campaign not found.');
    const limEngagement = await this.subscription.getLimits(userId);

    const rows = await this.prisma.campaignSendLog.findMany({
      where: { userId, campaignId, emailAccountId },
      orderBy: { sentAt: 'desc' },
      take: Math.min(Math.max(1, take), 500),
      include: {
        recipient: {
          select: {
            replied: true,
            opened: true,
            targetEmail: true,
            emailListItem: {
              select: {
                companyName: true,
                siteUrl: true,
                country: true,
                emails: true,
              },
            },
          },
        },
      },
    });

    return {
      campaign: camp,
      emailAccountId,
      engagementStats: limEngagement.engagementStats,
      rows: rows.map((r) => ({
        sentAt: r.sentAt,
        replied: limEngagement.engagementStats ? (r.recipient?.replied ?? false) : false,
        opened: limEngagement.engagementStats ? (r.recipient?.opened ?? false) : false,
        targetEmail: r.recipient?.targetEmail || r.targetEmail || '',
        companyName: r.recipient?.emailListItem?.companyName ?? '',
        siteUrl: r.recipient?.emailListItem?.siteUrl ?? '',
        country: r.recipient?.emailListItem?.country ?? '',
        emails: (r.recipient?.emailListItem?.emails as unknown as string[]) ?? [],
      })),
    };
  }

  private async assertCampaignNameUnique(userId: string, name: string, excludeId?: string) {
    const nm = name?.trim() || 'Untitled campaign';
    const dup = await this.prisma.campaign.findFirst({
      where: {
        userId,
        deletedAt: null,
        name: { equals: nm, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException('A campaign with this name already exists.');
  }

  async list(userId: string) {
    const rows = await this.prisma.campaign.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        emailList: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });
    // Sort groups: running → paused → completed → draft (scheduled treated like running group but after running).
    const prio: Record<CampaignStatus, number> = {
      [CampaignStatus.RUNNING]: 0,
      [CampaignStatus.SCHEDULED]: 1,
      [CampaignStatus.PAUSED]: 2,
      [CampaignStatus.COMPLETED]: 3,
      [CampaignStatus.DRAFT]: 4,
    };
    rows.sort((a, b) => {
      const pa = prio[a.status] ?? 99;
      const pb = prio[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const campaignIds = rows.map((r) => r.id);
    if (!campaignIds.length) {
      return rows.map((r) => ({
        ...r,
        sentRecipients: 0,
        remainingRecipients: 0,
        openedRecipients: 0,
        repliedRecipients: 0,
        openRatePct: 0,
        replyRatePct: 0,
        senderAccountNames: [] as string[],
      }));
    }

    const allSenderIds = new Set<string>();
    for (const r of rows) {
      for (const sid of parseSenderAccountIds(r.senderAccountIds)) {
        allSenderIds.add(sid);
      }
    }
    const accountRows =
      allSenderIds.size > 0
        ? await this.prisma.emailAccount.findMany({
            where: { userId, id: { in: [...allSenderIds] }, deletedAt: null },
            select: { id: true, fromEmail: true },
          })
        : [];
    const emailByAccountId = new Map(accountRows.map((a) => [a.id, (a.fromEmail || '').trim() || a.id]));

    const limEngagement = await this.subscription.getLimits(userId);

    const [sentGroups, remainingGroups, openedGroups, repliedGroups] = await Promise.all([
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds }, lastSentAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: {
          campaignId: { in: campaignIds },
          // "Pending" in UI means "not sent yet" (first touch not happened).
          lastSentAt: null,
          status: {
            in: [
              CampaignRecipientStatus.PENDING,
              CampaignRecipientStatus.QUEUED,
              CampaignRecipientStatus.ACTIVE,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds }, opened: true, lastSentAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds }, replied: true, lastSentAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const sentMap = new Map(sentGroups.map((g) => [g.campaignId, g._count._all]));
    const remMap = new Map(remainingGroups.map((g) => [g.campaignId, g._count._all]));
    const openedMap = new Map(openedGroups.map((g) => [g.campaignId, g._count._all]));
    const repliedMap = new Map(repliedGroups.map((g) => [g.campaignId, g._count._all]));
    return rows.map((r) => {
      const sent = sentMap.get(r.id) ?? 0;
      let opened = openedMap.get(r.id) ?? 0;
      let replied = repliedMap.get(r.id) ?? 0;
      if (!limEngagement.engagementStats) {
        opened = 0;
        replied = 0;
      }
      const senderAccountNames = parseSenderAccountIds(r.senderAccountIds).map(
        (id) => emailByAccountId.get(id) ?? 'Unknown account',
      );
      return {
        ...r,
        sentRecipients: sent,
        remainingRecipients: remMap.get(r.id) ?? 0,
        openedRecipients: opened,
        repliedRecipients: replied,
        openRatePct: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        replyRatePct: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        senderAccountNames,
        engagementStats: limEngagement.engagementStats,
      };
    });
  }

  async get(userId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        emailList: true,
        recipients: { take: 50, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!c) throw new NotFoundException('Campaign not found.');
    return c;
  }

  async createDraft(userId: string, name: string) {
    const nm = name?.trim() || `New campaign ${randomBytes(3).toString('hex')}`;
    await this.assertCampaignNameUnique(userId, nm);
    return this.prisma.$transaction(async (tx) => {
      await this.subscription.assertAndConsumeNewCampaignDraft(userId, tx);
      let list = await tx.emailList.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (!list) {
        await this.subscription.assertAndConsumeNewList(userId, tx);
        list = await tx.emailList.create({
          data: { userId, name: 'My list', autoUpdate: EmailListAutoUpdate.OFF },
        });
      }
      return tx.campaign.create({
        data: {
          userId,
          name: nm,
          emailListId: list.id,
          status: CampaignStatus.DRAFT,
        },
      });
    });
  }

  async update(
    userId: string,
    id: string,
    body: Record<string, unknown> & {
      senderAccountIds?: string[];
      mainSequence?: ChainStep[];
      followUpSequence?: ChainStep[];
      followUpStartRule?: unknown;
      checkListEntries?: unknown;
      mainFlowGraph?: unknown;
      pauseReason?: string | null;
    },
  ) {
    const c = await this.prisma.campaign.findFirst({ where: { id, userId, deletedAt: null } });
    if (!c) throw new NotFoundException('Campaign not found.');

    /** Paused after it had already started: only allow daily cap + wizard step (for UI), nothing that would reset progress. */
    const isPausedAfterRun = c.status === CampaignStatus.PAUSED && c.startedAt != null;
    if (isPausedAfterRun) {
      const rec = body as Record<string, unknown>;
      const providedKeys = Object.keys(rec).filter((k) => rec[k] !== undefined);
      const allowed = new Set(['dailyCampaignLimit', 'wizardStep']);
      const disallowed = providedKeys.filter((k) => !allowed.has(k));
      if (disallowed.length) {
        throw new BadRequestException(
          'For a paused campaign that was already running, only the daily campaign sending limit can be changed. Resume does not restart the campaign from the beginning.',
        );
      }
      const data: Prisma.CampaignUpdateInput = {};
      if (body.dailyCampaignLimit !== undefined) {
        const v = body.dailyCampaignLimit as number | null | undefined;
        data.dailyCampaignLimit = (v != null && Number(v) > 0 ? Number(v) : null) as never;
      }
      if (body.wizardStep !== undefined) {
        data.wizardStep = body.wizardStep as number;
      }
      if (Object.keys(data).length === 0) {
        return c;
      }
      return this.prisma.campaign.update({ where: { id }, data });
    }

    const effTier = await this.subscription.effectiveTier(userId);
    this.subscription.assertCampaignSequences(effTier, {
      senderAccountIds: body.senderAccountIds ?? (c.senderAccountIds as unknown),
      mainSequence: body.mainSequence ?? (c.mainSequence as unknown),
      followUpSequence: body.followUpSequence ?? (c.followUpSequence as unknown),
      mainFlowGraph: body.mainFlowGraph ?? (c.mainFlowGraph as unknown),
    });

    if (body.name !== undefined && typeof body.name === 'string') {
      await this.assertCampaignNameUnique(userId, body.name, id);
    }
    if (c.status === CampaignStatus.RUNNING && body.status === CampaignStatus.DRAFT) {
      throw new BadRequestException('Pause the campaign before changing to draft.');
    }
    const data: Prisma.CampaignUpdateInput = {};
    const assign = <K extends keyof Prisma.CampaignUpdateInput>(k: K, v: Prisma.CampaignUpdateInput[K]) => {
      data[k] = v;
    };
    if (body.emailListId !== undefined) {
      data.emailList = { connect: { id: body.emailListId as string } };
    }
    const scalarKeys: (keyof Prisma.CampaignUpdateInput)[] = [
      'name',
      'status',
      'wizardStep',
      'doNotSendUnverified',
      'doNotSendRisky',
      'doNotSendInvalid',
      'multiEmailPolicy',
      'skipIfInOtherCampaign',
      'missingVariablePolicy',
      'stopFollowUpsOnReply',
      'stopCampaignOnCompanyReply',
      'dailyCampaignLimit',
      'scheduledAt',
      'startedAt',
      'completedAt',
    ];
    for (const k of scalarKeys) {
      if (body[k] === undefined) continue;
      if (k === 'dailyCampaignLimit') {
        const v = body.dailyCampaignLimit as number | null | undefined;
        assign('dailyCampaignLimit', (v != null && Number(v) > 0 ? Number(v) : null) as never);
        continue;
      }
      assign(k, body[k] as Prisma.CampaignUpdateInput[typeof k]);
    }
    if (body.senderAccountIds !== undefined) {
      data.senderAccountIds = body.senderAccountIds as unknown as Prisma.InputJsonValue;
    }
    if (body.mainSequence !== undefined) {
      data.mainSequence = body.mainSequence as unknown as Prisma.InputJsonValue;
    }
    if (body.followUpSequence !== undefined) {
      data.followUpSequence = body.followUpSequence as unknown as Prisma.InputJsonValue;
    }
    if (body.followUpStartRule !== undefined) {
      data.followUpStartRule = body.followUpStartRule as Prisma.InputJsonValue;
    }
    if (body.checkListEntries !== undefined) {
      data.checkListEntries = body.checkListEntries as Prisma.InputJsonValue;
    }
    if (body.mainFlowGraph !== undefined) {
      data.mainFlowGraph = body.mainFlowGraph as unknown as Prisma.InputJsonValue;
    }
    if (body.pauseReason !== undefined) {
      data.pauseReason = (body.pauseReason as string | null) ?? null;
    }
    return this.prisma.campaign.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id, userId, deletedAt: null } });
    if (!c) throw new NotFoundException('Campaign not found.');
    if (c.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Pause the campaign before deleting it.');
    }
    // Permanent delete (no trash for campaigns). Cascade deletes recipients via Prisma schema.
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  async pause(userId: string, id: string, reason?: string | null) {
    const c = await this.prisma.campaign.findFirst({ where: { id, userId, deletedAt: null } });
    if (!c) throw new NotFoundException('Campaign not found.');
    const r = typeof reason === 'string' ? reason.trim() : '';
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED, pauseReason: r || null },
    });
  }

  async buildRecipients(
    userId: string,
    campaignId: string,
    buildOpts?: { forceNextSendNow?: boolean },
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, userId, deletedAt: null },
      include: { emailList: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');

    await this.subscription.assertCampaignListRecipientCap(userId, campaign.emailListId);

    const items = await this.prisma.emailListItem.findMany({ where: { listId: campaign.emailListId } });
    const senderIds = parseSenderAccountIds(campaign.senderAccountIds);
    if (!senderIds.length) throw new BadRequestException('Select at least one sender account.');
    const limAccounts = await this.subscription.getLimits(userId);
    if (limAccounts.sendersPerCampaign != null && senderIds.length > limAccounts.sendersPerCampaign) {
      throw new BadRequestException(
        `Your plan allows ${limAccounts.sendersPerCampaign} sender account(s) per campaign.`,
      );
    }

    const hadUsableSequenceInDb = ((campaign.mainSequence as unknown as ChainStep[]) ?? []).some(
      (x) => x?.templateId,
    );
    const main = resolveMainChainFromCampaign(campaign);
    if (!main.length || !main[0]?.templateId) {
      throw new BadRequestException('Add at least one email step in the campaign sequence.');
    }
    if (!hadUsableSequenceInDb) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { mainSequence: main as unknown as Prisma.InputJsonValue },
      });
    }

    const skipOther = campaign.skipIfInOtherCampaign;
    const otherCampaigns = await this.prisma.campaign.findMany({
      where: {
        userId,
        deletedAt: null,
        id: { not: campaignId },
        status: { in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] },
      },
      select: { id: true },
    });
    const otherIds = otherCampaigns.map((x) => x.id);
    const inOther = new Set<string>();
    if (skipOther && otherIds.length) {
      const rel = await this.prisma.campaignRecipient.findMany({
        where: { campaignId: { in: otherIds } },
        select: { emailListItemId: true },
      });
      for (const r of rel) inOther.add(r.emailListItemId);
    }

    await this.prisma.campaignRecipient.deleteMany({ where: { campaignId } });

    const multi = campaign.multiEmailPolicy;
    let created = 0;
    const checkList: { email: string; reason: string; siteUrl: string }[] = [];
    /** One send row per normalized address per campaign (avoids duplicate sends). */
    const seenTargetEmails = new Set<string>();

    for (const it of items) {
      if (skipOther && inOther.has(it.id)) {
        checkList.push({
          email: '',
          reason:
            'Not added — this prospect is already in another running or scheduled campaign (skipped by your rule).',
          siteUrl: it.siteUrl,
        });
        continue;
      }

      if (!this.allowItem(it, campaign)) {
        checkList.push({
          email: '',
          reason: 'Not added — filtered by campaign email-risk rules.',
          siteUrl: it.siteUrl,
        });
        continue;
      }

      const cells = prospectEmailCellsFromImport(it.emails);
      if (!cells.length) {
        checkList.push({
          email: '',
          reason:
            'No usable email — this prospect row has no email fields stored as text (check your list import mapped the email column).',
          siteUrl: it.siteUrl,
        });
        continue;
      }

      /** Valid trimmed addresses preserved in spreadsheet order within this row */
      const validInOrder: string[] = [];
      for (const cell of cells) {
        const rej = campaignProspectEmailRejection(cell);
        if (rej) {
          checkList.push({
            email: cell.trim() ? cell.slice(0, 120) : '(empty)',
            reason: rej,
            siteUrl: it.siteUrl,
          });
          continue;
        }
        validInOrder.push(cell.trim());
      }

      if (!validInOrder.length) {
        continue;
      }

      const targets =
        multi === MultiEmailPolicy.FIRST ? validInOrder.slice(0, 1) : validInOrder;

      const tplFirst = await this.prisma.emailTemplate.findFirst({
        where: { id: main[0].templateId, userId, deletedAt: null },
      });

      for (const email of targets) {
        const emailNorm = email.toLowerCase();
        if (seenTargetEmails.has(emailNorm)) {
          checkList.push({
            email,
            reason: 'Not added — duplicate address already selected for this campaign build.',
            siteUrl: it.siteUrl,
          });
          continue;
        }
        seenTargetEmails.add(emailNorm);

        if (tplFirst) {
          const vars = buildMergeVars(it);
          const subjMissing = missingMergeVars(tplFirst.subject, vars);
          const bodyMissing = missingMergeVars(tplFirst.body, vars);
          const miss = [...new Set([...subjMissing, ...bodyMissing])];
          if (miss.length) {
            checkList.push({
              email,
              reason: `Not added — missing merge variables required by the template: ${miss.join(', ')}.`,
              siteUrl: it.siteUrl,
            });
            if (campaign.missingVariablePolicy === MissingVariablePolicy.TO_CHECK_LIST) continue;
          }
        }

        const nextSend =
          buildOpts?.forceNextSendNow === true
            ? new Date()
            : campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()
              ? campaign.scheduledAt
              : new Date();

        await this.prisma.campaignRecipient.create({
          data: {
            campaignId,
            emailListItemId: it.id,
            phase: 'main',
            stepIndex: 0,
            nextSendAt: nextSend,
            status: CampaignRecipientStatus.QUEUED,
            targetEmail: email,
          },
        });
        created++;
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { checkListEntries: checkList as unknown as Prisma.InputJsonValue },
    });

    if (checkList.length) {
      await this.notifyCampaignRecipientSkips(userId, campaign.name, campaignId, checkList);
    }

    return { created, checkList };
  }

  /** Best-effort in-app notification (English copy) describing rows that were not turned into recipients. */
  private async notifyCampaignRecipientSkips(
    userId: string,
    campaignName: string,
    campaignId: string,
    checkList: { email: string; reason: string; siteUrl: string }[],
  ) {
    try {
      const maxLines = 18;
      const lines = checkList.slice(0, maxLines).map((row) => {
        const site = row.siteUrl?.trim() || '(unknown site)';
        const em = row.email?.trim()
          ? ` — ${row.email.trim().slice(0, 80)}`
          : '';
        return `• ${site}${em}: ${row.reason}`;
      });
      const more =
        checkList.length > maxLines
          ? `\n…plus ${checkList.length - maxLines} more rows (full list stays on this campaign under the latest “to-check” summary).`
          : '';
      const header = `${checkList.length} prospect row(s) from your list could not be added as campaign recipients when the campaign was built.`;
      let message = [header, '', ...lines, more].join('\n').trim();
      message = message.slice(0, 4000);

      const nm = campaignName.trim();
      const title = (
        nm
          ? `"${nm.slice(0, 96)}": ${checkList.length} row(s) not added to the campaign`
          : `${checkList.length} campaign row(s) were not added (see reasons below)`
      ).slice(0, 200);

      await this.notifications.create(userId, {
        kind: 'warning',
        title,
        message,
        href: `/email-marketing/campaigns/${campaignId}`,
      });
    } catch {
      /* never block build on notifications */
    }
  }

  private allowItem(
    it: { emailRisk: EmailRiskLevel },
    campaign: { doNotSendUnverified: boolean; doNotSendRisky: boolean; doNotSendInvalid: boolean },
  ) {
    if (campaign.doNotSendInvalid && it.emailRisk === EmailRiskLevel.INVALID) return false;
    if (campaign.doNotSendRisky && it.emailRisk === EmailRiskLevel.RISKY) return false;
    if (campaign.doNotSendUnverified && it.emailRisk === EmailRiskLevel.UNVERIFIED) return false;
    return true;
  }

  async start(
    userId: string,
    campaignId: string,
    opts: { scheduledAt?: string | null; skipRecipientBuild?: boolean } = {},
  ) {
    let c = await this.prisma.campaign.findFirst({
      where: { id: campaignId, userId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Campaign not found.');
    if (c.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('This campaign is already completed.');
    }
    const prevStatus = c.status;
    const prevStartedAt = c.startedAt;

    if (opts.scheduledAt != null && opts.scheduledAt !== '') {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { scheduledAt: new Date(opts.scheduledAt) },
      });
      c = (await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId, deletedAt: null },
      }))!;
    }

    const schedPeek = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { scheduledAt: true },
    });
    const scheduleForFuture = Boolean(
      schedPeek?.scheduledAt && schedPeek.scheduledAt.getTime() > Date.now() + 500,
    );

    /**
     * If scheduling in the future: mark SCHEDULED (tick only sends RUNNING).
     * If starting now: mark RUNNING *before* building recipients so the background sender (`tick`) does not skip
     * rows while status was still DRAFT/PAUSED (processRecipient only sends for RUNNING).
     */
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: scheduleForFuture
        ? { status: CampaignStatus.SCHEDULED, startedAt: null }
        : { status: CampaignStatus.RUNNING, startedAt: new Date() },
    });

    try {
      if (!opts.skipRecipientBuild) {
        await this.buildRecipients(userId, campaignId, { forceNextSendNow: !scheduleForFuture });
      } else {
        const n = await this.prisma.campaignRecipient.count({ where: { campaignId } });
        if (n === 0) {
          throw new BadRequestException(
            'No recipients built yet. Use “Build recipients” first or launch without skipping the build.',
          );
        }
        if (!scheduleForFuture) {
          await this.prisma.campaignRecipient.updateMany({
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
            data: { nextSendAt: new Date() },
          });
        }
      }
    } catch (e) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: prevStatus, startedAt: prevStartedAt },
      });
      throw e;
    }

    const fresh = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    // Keep scheduledAt if in the future; otherwise normalize to "now".
    if (!fresh) return null;
    const shouldNormalizeToNow = !fresh.scheduledAt || fresh.scheduledAt.getTime() <= Date.now();
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { scheduledAt: shouldNormalizeToNow ? new Date() : fresh.scheduledAt },
    });
  }

  async createUnsubscribeToken(userId: string, emailNorm: string) {
    const norm = emailNorm.toLowerCase();
    const existing = await this.prisma.unsubscribeToken.findFirst({
      where: { userId, emailNorm: norm },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing.token;
    const token = randomBytes(24).toString('hex');
    await this.prisma.unsubscribeToken.create({
      data: { token, userId, emailNorm: norm, expiresAt: null },
    });
    return token;
  }

  renderTemplateForSend(
    tpl: { subject: string; body: string; includeUnsubscribeBlock: boolean },
    item: Parameters<typeof buildMergeVars>[0],
    unsubscribeUrl: string,
  ) {
    const vars = buildMergeVars(item);
    const mergedBody = applyMergeTemplate(tpl.body, vars);
    const hasInlineUnsub = bodyHasInlineUnsubscribe(mergedBody);
    let body = expandLgUnsubTokensToAnchor(mergedBody, unsubscribeUrl).split(INLINE_UNSUBSCRIBE_HREF).join(
      unsubscribeUrl,
    );
    const subject = applyMergeTemplate(tpl.subject, vars);
    if (tpl.includeUnsubscribeBlock && unsubscribeUrl && !hasInlineUnsub) {
      body += `\n\n---\n<a href="${unsubscribeUrl}">Unsubscribe</a>`;
    }
    return { subject, body };
  }
}
