import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailAccount, EmailAccountProvider, Prisma, SmtpEncryption } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from './crypto-secret';
import { EmailImapSyncService } from './email-imap-sync.service';

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class EmailAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imapSync: EmailImapSyncService,
  ) {}

  /** True when mailbox sync API can run for this row (OAuth or SMTP+IMAP). */
  canSyncMailbox(a: EmailAccount): boolean {
    if (a.provider === EmailAccountProvider.GMAIL_API || a.provider === EmailAccountProvider.OUTLOOK) return true;
    if (a.provider === EmailAccountProvider.SMTP) {
      return !!(a.imapHost?.trim() && a.imapPort && a.imapUser?.trim() && a.imapPasswordEnc);
    }
    return false;
  }

  /** Campaign-ready vs unusable — no separate "pending" state in the UI. */
  private connectionListStatus(a: EmailAccount): 'connected' | 'invalid' {
    if (a.provider === EmailAccountProvider.GMAIL_API || a.provider === EmailAccountProvider.OUTLOOK) {
      return 'connected';
    }
    const smtpLike =
      a.provider === EmailAccountProvider.SMTP ||
      a.provider === EmailAccountProvider.GMAIL_SMTP ||
      a.provider === EmailAccountProvider.OTHER;
    if (!smtpLike) return 'invalid';
    const smtpOk = !!(a.smtpHost?.trim() && a.smtpUser?.trim() && a.smtpPasswordEnc);
    if (!smtpOk) return 'invalid';
    if (a.connectionInvalid) return 'invalid';
    return 'connected';
  }

  /** Case-insensitive display name + exact tag (per user). */
  async availability(
    userId: string,
    displayName?: string,
    tag?: string,
  ): Promise<{ displayNameTaken: boolean; tagTaken: boolean }> {
    const out = { displayNameTaken: false, tagTaken: false };
    const d = displayName?.trim();
    if (d) {
      const c = await this.prisma.emailAccount.count({
        where: {
          userId,
          deletedAt: null,
          displayName: { equals: d, mode: 'insensitive' },
        },
      });
      out.displayNameTaken = c > 0;
    }
    const t = tag?.trim();
    if (t) {
      const c = await this.prisma.emailAccount.count({
        where: { userId, deletedAt: null, tag: t },
      });
      out.tagTaken = c > 0;
    }
    return out;
  }

  async listTrash(userId: string) {
    const rows = await this.prisma.emailAccount.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((a) => ({
      ...this.maskAccount(a),
      connectionStatus: this.connectionListStatus(a),
      canSyncMailbox: this.canSyncMailbox(a),
    }));
  }

  async list(userId: string) {
    const rows = await this.prisma.emailAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const adjusted: EmailAccount[] = [];
    for (const row of rows) {
      const next = await this.ensureDailyCounter(row.id);
      adjusted.push((next as EmailAccount | null) ?? row);
    }
    return adjusted.map((a) => ({
      ...this.maskAccount(a),
      connectionStatus: this.connectionListStatus(a),
      canSyncMailbox: this.canSyncMailbox(a),
    }));
  }

  async createSmtp(
    userId: string,
    dto: {
      displayName: string;
      fromEmail: string;
      tag: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPassword: string;
      smtpEncryption: SmtpEncryption;
      dailyLimit?: number;
      delayMinSec?: number;
      delayMaxSec?: number;
      signature?: string;
      bcc?: string;
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapPassword?: string;
      imapEncryption?: SmtpEncryption;
    },
  ) {
    const tag = dto.tag.trim();
    if (!tag) throw new BadRequestException('Tag is required.');
    const displayTrim = dto.displayName.trim();
    if (!displayTrim) throw new BadRequestException('Display name is required.');
    const dupName = await this.prisma.emailAccount.findFirst({
      where: {
        userId,
        deletedAt: null,
        displayName: { equals: displayTrim, mode: 'insensitive' },
      },
    });
    if (dupName) {
      throw new ConflictException(
        'An account with this display name already exists. Please choose a different display name.',
      );
    }
    const hasImap =
      !!(dto.imapHost?.trim() || dto.imapPort || dto.imapUser?.trim() || dto.imapPassword?.trim());
    if (hasImap) {
      if (!dto.imapHost?.trim() || !dto.imapPort || !dto.imapUser?.trim() || !dto.imapPassword?.trim()) {
        throw new BadRequestException('IMAP host, port, user, and password are required when using IMAP.');
      }
    }
    const enc = encryptSecret(dto.smtpPassword);
    const imapEnc = hasImap ? encryptSecret(dto.imapPassword!.trim()) : null;
    let created: EmailAccount;
    try {
      created = await this.prisma.emailAccount.create({
        data: {
          userId,
          provider: EmailAccountProvider.SMTP,
          displayName: displayTrim,
          fromEmail: dto.fromEmail.trim().toLowerCase(),
          tag,
          smtpHost: dto.smtpHost.trim(),
          smtpPort: dto.smtpPort,
          smtpUser: dto.smtpUser.trim(),
          smtpPasswordEnc: enc,
          smtpEncryption: dto.smtpEncryption,
          imapHost: hasImap ? dto.imapHost!.trim() : null,
          imapPort: hasImap ? dto.imapPort! : null,
          imapUser: hasImap ? dto.imapUser!.trim() : null,
          imapPasswordEnc: imapEnc,
          imapEncryption: hasImap ? (dto.imapEncryption ?? SmtpEncryption.TLS) : SmtpEncryption.TLS,
          dailyLimit: dto.dailyLimit ?? 10,
          delayMinSec: dto.delayMinSec ?? 200,
          delayMaxSec: dto.delayMaxSec ?? 200,
          signature: dto.signature ?? '',
          bcc: dto.bcc ?? '',
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This tag is already used by another account.');
      }
      throw e;
    }
    try {
      await this.verifySmtp(userId, created.id);
    } catch {
      /* verifySmtp marks connectionInvalid on failure */
    }
    return this.prisma.emailAccount.findUniqueOrThrow({ where: { id: created.id } });
  }

  newOAuthTag(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  }

  /** Pre-encrypted tokens (e.g. from OAuth callback). */
  async createOAuthAccountLinked(
    userId: string,
    data: {
      provider: EmailAccountProvider;
      refreshTokenEnc: string;
      accessTokenEnc: string | null;
      accessExpiresAt: Date | null;
      fromEmail: string;
      displayName: string;
    },
  ) {
    const tag = this.newOAuthTag(data.provider === EmailAccountProvider.GMAIL_API ? 'g' : 'ms');
    try {
      return await this.prisma.emailAccount.create({
        data: {
          userId,
          provider: data.provider,
          displayName: data.displayName.trim(),
          fromEmail: data.fromEmail.trim().toLowerCase(),
          tag,
          oauthRefreshEnc: data.refreshTokenEnc,
          oauthAccessEnc: data.accessTokenEnc ?? undefined,
          oauthExpiresAt: data.accessExpiresAt ?? undefined,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Could not create account (tag conflict). Try again.');
      }
      throw e;
    }
  }

  async getOAuthPending(userId: string, pendingId: string) {
    const p = await this.prisma.emailOAuthPending.findFirst({
      where: { id: pendingId, userId, expiresAt: { gt: new Date() } },
    });
    if (!p) throw new NotFoundException('This link expired or is invalid.');
    return {
      provider: p.provider,
      candidates: p.candidates as { email: string; displayName: string }[],
    };
  }

  async completeOAuthPending(userId: string, pendingId: string, email: string) {
    const p = await this.prisma.emailOAuthPending.findFirst({
      where: { id: pendingId, userId, expiresAt: { gt: new Date() } },
    });
    if (!p) throw new NotFoundException('This link expired or is invalid.');
    const candidates = p.candidates as { email: string; displayName: string }[];
    const pick = candidates.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
    if (!pick) throw new BadRequestException('Select a valid address from the list.');
    const provider =
      p.provider === 'google' ? EmailAccountProvider.GMAIL_API : EmailAccountProvider.OUTLOOK;
    try {
      const acc = await this.prisma.emailAccount.create({
        data: {
          userId,
          provider,
          displayName: pick.displayName?.trim() || pick.email,
          fromEmail: pick.email.trim().toLowerCase(),
          tag: this.newOAuthTag(p.provider === 'google' ? 'g' : 'ms'),
          oauthRefreshEnc: p.refreshTokenEnc,
          oauthAccessEnc: p.accessTokenEnc ?? undefined,
          oauthExpiresAt: p.accessExpiresAt ?? undefined,
          connectionVerifiedAt: new Date(),
          connectionInvalid: false,
        },
      });
      await this.prisma.emailOAuthPending.delete({ where: { id: p.id } });
      return acc;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Could not create account (tag conflict). Try again.');
      }
      throw e;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<{
      displayName: string;
      fromEmail: string;
      tag: string;
      dailyLimit: number;
      delayMinSec: number;
      delayMaxSec: number;
      signature: string;
      bcc: string;
      smtpPassword: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpEncryption: SmtpEncryption;
      imapHost?: string | null;
      imapPort?: number | null;
      imapUser?: string | null;
      imapPassword?: string;
      imapEncryption?: SmtpEncryption;
      campaignsEnabled?: boolean;
    }>,
  ) {
    const acc = await this.prisma.emailAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Account not found.');
    const data: Prisma.EmailAccountUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim();
    if (dto.fromEmail !== undefined) data.fromEmail = dto.fromEmail.trim().toLowerCase();
    if (dto.tag !== undefined) data.tag = dto.tag.trim();
    if (dto.dailyLimit !== undefined) data.dailyLimit = dto.dailyLimit;
    if (dto.delayMinSec !== undefined) data.delayMinSec = dto.delayMinSec;
    if (dto.delayMaxSec !== undefined) data.delayMaxSec = dto.delayMaxSec;
    if (dto.signature !== undefined) data.signature = dto.signature;
    if (dto.bcc !== undefined) data.bcc = dto.bcc;
    if (dto.campaignsEnabled !== undefined) data.campaignsEnabled = dto.campaignsEnabled;
    if (dto.smtpHost !== undefined) data.smtpHost = dto.smtpHost.trim();
    if (dto.smtpPort !== undefined) data.smtpPort = dto.smtpPort;
    if (dto.smtpUser !== undefined) data.smtpUser = dto.smtpUser.trim();
    if (dto.smtpEncryption !== undefined) data.smtpEncryption = dto.smtpEncryption;
    if (dto.smtpPassword !== undefined && dto.smtpPassword.length > 0) {
      data.smtpPasswordEnc = encryptSecret(dto.smtpPassword);
    }
    if (dto.imapHost !== undefined) data.imapHost = dto.imapHost ? dto.imapHost.trim() : null;
    if (dto.imapPort !== undefined) data.imapPort = dto.imapPort;
    if (dto.imapUser !== undefined) data.imapUser = dto.imapUser ? dto.imapUser.trim() : null;
    if (dto.imapEncryption !== undefined) data.imapEncryption = dto.imapEncryption;
    if (dto.imapPassword !== undefined && dto.imapPassword.length > 0) {
      data.imapPasswordEnc = encryptSecret(dto.imapPassword);
    }
    const authTouched =
      dto.smtpHost !== undefined ||
      dto.smtpPort !== undefined ||
      dto.smtpUser !== undefined ||
      dto.smtpEncryption !== undefined ||
      dto.smtpPassword !== undefined ||
      dto.imapHost !== undefined ||
      dto.imapPort !== undefined ||
      dto.imapUser !== undefined ||
      dto.imapEncryption !== undefined ||
      dto.imapPassword !== undefined;
    if (authTouched) {
      data.connectionVerifiedAt = null;
      data.connectionInvalid = false;
    }
    try {
      let row = await this.prisma.emailAccount.update({ where: { id }, data });
      const smtpLike =
        row.provider === EmailAccountProvider.SMTP ||
        row.provider === EmailAccountProvider.GMAIL_SMTP ||
        row.provider === EmailAccountProvider.OTHER;
      if (authTouched && smtpLike && row.smtpPasswordEnc) {
        try {
          await this.verifySmtp(userId, id);
        } catch {
          /* verifySmtp marks connectionInvalid on failure */
        }
        row = await this.prisma.emailAccount.findUniqueOrThrow({ where: { id } });
      }
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This tag is already used by another account.');
      }
      throw e;
    }
  }

  async softDelete(userId: string, id: string) {
    const acc = await this.prisma.emailAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Account not found.');
    await this.prisma.emailAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async restore(userId: string, id: string) {
    const acc = await this.prisma.emailAccount.findFirst({ where: { id, userId } });
    if (!acc) throw new NotFoundException('Account not found.');
    await this.prisma.emailAccount.update({ where: { id }, data: { deletedAt: null } });
    return { ok: true };
  }

  async getOne(userId: string, id: string) {
    const acc = await this.prisma.emailAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Account not found.');
    return {
      ...this.maskAccount(acc),
      smtpHost: acc.smtpHost,
      smtpPort: acc.smtpPort,
      smtpUser: acc.smtpUser,
      smtpEncryption: acc.smtpEncryption,
      hasSmtpPassword: !!acc.smtpPasswordEnc,
      imapHost: acc.imapHost,
      imapPort: acc.imapPort,
      imapUser: acc.imapUser,
      imapEncryption: acc.imapEncryption,
      hasImapPassword: !!acc.imapPasswordEnc,
      provider: acc.provider,
      connectionStatus: this.connectionListStatus(acc),
    };
  }

  async verifySmtp(userId: string, id: string) {
    const acc = await this.prisma.emailAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!acc || !acc.smtpPasswordEnc) throw new NotFoundException('Account not found or not SMTP.');
    const smtpLike =
      acc.provider === EmailAccountProvider.SMTP ||
      acc.provider === EmailAccountProvider.GMAIL_SMTP ||
      acc.provider === EmailAccountProvider.OTHER;
    if (!smtpLike) throw new BadRequestException('Verification is only for SMTP-style accounts.');
    try {
      const pass = decryptSecret(acc.smtpPasswordEnc);
      const transporter = this.buildTransport(acc, pass);
      await transporter.verify();
      if (this.imapSync.hasImapCredentials(acc)) {
        await this.imapSync.verifyImap(acc);
      }
      await this.prisma.emailAccount.update({
        where: { id },
        data: { connectionVerifiedAt: new Date(), connectionInvalid: false },
      });
      return { ok: true };
    } catch (e) {
      await this.prisma.emailAccount
        .update({
          where: { id },
          data: { connectionVerifiedAt: null, connectionInvalid: true },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  buildTransport(
    acc: { smtpHost: string | null; smtpPort: number | null; smtpUser: string | null; smtpEncryption: SmtpEncryption; fromEmail: string },
    password: string,
  ) {
    const secure = acc.smtpEncryption === SmtpEncryption.SSL;
    return nodemailer.createTransport({
      host: acc.smtpHost ?? undefined,
      port: acc.smtpPort ?? 587,
      secure,
      auth: acc.smtpUser ? { user: acc.smtpUser, pass: password } : undefined,
      requireTLS: acc.smtpEncryption === SmtpEncryption.TLS,
    });
  }

  async getDecryptedPassword(accId: string): Promise<string | null> {
    const acc = await this.prisma.emailAccount.findUnique({ where: { id: accId } });
    if (!acc?.smtpPasswordEnc) return null;
    return decryptSecret(acc.smtpPasswordEnc);
  }

  /** Reset daily counter if new UTC day. */
  async ensureDailyCounter(accountId: string) {
    const acc = await this.prisma.emailAccount.findUnique({ where: { id: accountId } });
    if (!acc) return acc;
    const today = startOfUtcDay(new Date());
    const last = acc.sentTodayDate ? startOfUtcDay(acc.sentTodayDate) : null;
    if (!last || last.getTime() !== today.getTime()) {
      return this.prisma.emailAccount.update({
        where: { id: accountId },
        data: { sentToday: 0, sentTodayDate: today },
      });
    }
    return acc;
  }

  /**
   * @param nextSendAllowedAt — after this send, account cannot send again until this time (inter-send delay).
   */
  async incrementSent(accountId: string, nextSendAllowedAt: Date) {
    await this.ensureDailyCounter(accountId);
    return this.prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        sentToday: { increment: 1 },
        sentTotal: { increment: 1 },
        nextSendAllowedAt,
      },
    });
  }

  maskAccount(a: {
    smtpPasswordEnc: string | null;
    oauthRefreshEnc: string | null;
    oauthAccessEnc: string | null;
    imapPasswordEnc?: string | null;
  }) {
    return {
      ...a,
      smtpPasswordEnc: a.smtpPasswordEnc ? '********' : null,
      oauthRefreshEnc: a.oauthRefreshEnc ? '********' : null,
      oauthAccessEnc: a.oauthAccessEnc ? '********' : null,
      imapPasswordEnc: a.imapPasswordEnc ? '********' : null,
    };
  }
}
