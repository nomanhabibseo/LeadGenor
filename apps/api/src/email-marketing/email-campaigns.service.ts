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
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
            select: { id: true, displayName: true },
          })
        : [];
    const displayNameByAccountId = new Map(
      accountRows.map((a) => [a.id, (a.displayName || '').trim() || a.id]),
    );

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
        where: { campaignId: { in: campaignIds }, opened: true },
        _count: { _all: true },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds }, replied: true },
        _count: { _all: true },
      }),
    ]);
    const sentMap = new Map(sentGroups.map((g) => [g.campaignId, g._count._all]));
    const remMap = new Map(remainingGroups.map((g) => [g.campaignId, g._count._all]));
    const openedMap = new Map(openedGroups.map((g) => [g.campaignId, g._count._all]));
    const repliedMap = new Map(repliedGroups.map((g) => [g.campaignId, g._count._all]));
    return rows.map((r) => {
      const sent = sentMap.get(r.id) ?? 0;
      const opened = openedMap.get(r.id) ?? 0;
      const replied = repliedMap.get(r.id) ?? 0;
      const senderAccountNames = parseSenderAccountIds(r.senderAccountIds).map(
        (id) => displayNameByAccountId.get(id) ?? 'Unknown account',
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
      };
    });
  }

  async listTrash(userId: string) {
    return this.prisma.campaign.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { updatedAt: 'desc' },
      include: {
        emailList: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });
  }

  async restore(userId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });
    if (!c) throw new NotFoundException('Deleted campaign not found.');
    return this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        emailList: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
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
    let list = await this.prisma.emailList.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (!list) {
      list = await this.prisma.emailList.create({
        data: { userId, name: 'My list', autoUpdate: EmailListAutoUpdate.OFF },
      });
    }
    return this.prisma.campaign.create({
      data: {
        userId,
        name: nm,
        emailListId: list.id,
        status: CampaignStatus.DRAFT,
      },
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
    await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

    const items = await this.prisma.emailListItem.findMany({ where: { listId: campaign.emailListId } });
    const senderIds = parseSenderAccountIds(campaign.senderAccountIds);
    if (!senderIds.length) throw new BadRequestException('Select at least one sender account.');

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
      if (skipOther && inOther.has(it.id)) continue;

      if (!this.allowItem(it, campaign)) {
        checkList.push({ email: '', reason: 'Filtered by email validation rules', siteUrl: it.siteUrl });
        continue;
      }

      const emails = (it.emails as unknown as string[]) ?? [];
      if (!emails.length) {
        checkList.push({ email: '', reason: 'No emails on record', siteUrl: it.siteUrl });
        continue;
      }

      const targets = multi === MultiEmailPolicy.FIRST ? emails.slice(0, 1) : emails;

      const tplFirst = await this.prisma.emailTemplate.findFirst({
        where: { id: main[0].templateId, userId, deletedAt: null },
      });

      for (const email of targets) {
        const emailNorm = email.trim().toLowerCase();
        if (emailNorm && seenTargetEmails.has(emailNorm)) {
          checkList.push({
            email,
            reason: "Duplicate address in this campaign list (skipped)",
            siteUrl: it.siteUrl,
          });
          continue;
        }
        if (emailNorm) seenTargetEmails.add(emailNorm);

        if (tplFirst) {
          const vars = buildMergeVars(it);
          const subjMissing = missingMergeVars(tplFirst.subject, vars);
          const bodyMissing = missingMergeVars(tplFirst.body, vars);
          const miss = [...new Set([...subjMissing, ...bodyMissing])];
          if (miss.length) {
            checkList.push({
              email,
              reason: `Missing variables: ${miss.join(', ')}`,
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

    return { created, checkList };
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
     * Mark RUNNING *before* building recipients so the background sender (`tick`) does not skip
     * rows while status was still DRAFT/PAUSED (processRecipient only sends for RUNNING).
     */
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.RUNNING, startedAt: new Date() },
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
    const scheduledAt =
      fresh?.scheduledAt && fresh.scheduledAt.getTime() > Date.now() ? fresh.scheduledAt : new Date();
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        scheduledAt,
      },
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
