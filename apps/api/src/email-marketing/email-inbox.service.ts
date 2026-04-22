import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmailAccountProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailImapSyncService } from './email-imap-sync.service';
import { EmailOAuthMailService, type MailboxFolder } from './email-oauth-mail.service';

const FOLDERS: MailboxFolder[] = ['inbox', 'sent', 'drafts'];

function normalizeFolder(f: string | undefined): string | undefined {
  if (!f) return undefined;
  const x = f.toLowerCase();
  return FOLDERS.includes(x as MailboxFolder) ? x : undefined;
}

/** PostgreSQL / JSON cannot store NUL; IMAP subjects sometimes include it. */
function stripInboxNul(s: string): string {
  return s.replace(/\u0000/g, '');
}

function truncateInboxField(s: string, max: number): string {
  const t = stripInboxNul(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function safeExternalMessageId(raw: string): string {
  const cleaned = stripInboxNul(raw);
  const t = cleaned.trim();
  if (!t) return `h:${createHash('sha256').update(cleaned || 'empty', 'utf8').digest('hex')}`;
  if (t.length <= 450) return t;
  return `h:${createHash('sha256').update(t, 'utf8').digest('hex')}`;
}

@Injectable()
export class EmailInboxService {
  private readonly log = new Logger(EmailInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthMail: EmailOAuthMailService,
    private readonly imapSync: EmailImapSyncService,
  ) {}

  async list(
    userId: string,
    opts: { accountId?: string; folder?: string; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const folder = normalizeFolder(opts.folder);
    const where: Prisma.InboxMessageWhereInput = { userId };
    if (opts.accountId) where.emailAccountId = opts.accountId;
    if (folder) where.folder = folder;
    return this.prisma.inboxMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: { emailAccount: { select: { displayName: true, fromEmail: true } } },
    });
  }

  /** Placeholder for manual / demo rows (no provider sync). */
  async addDemo(userId: string, body: { snippet: string; fromAddr: string; subject?: string }) {
    return this.prisma.inboxMessage.create({
      data: {
        userId,
        snippet: body.snippet,
        fromAddr: body.fromAddr,
        subject: body.subject ?? '',
        folder: 'inbox',
      },
    });
  }

  async syncMailbox(userId: string, accountId: string, folder: string) {
    const raw = folder.trim().toLowerCase();
    const folders: MailboxFolder[] =
      raw === 'all' ? ['inbox', 'sent', 'drafts'] : ((normalizeFolder(raw) as MailboxFolder | undefined) ? [normalizeFolder(raw) as MailboxFolder] : []);
    if (!folders.length) {
      throw new BadRequestException('folder must be inbox, sent, drafts, or all.');
    }

    const acc = await this.prisma.emailAccount.findFirst({
      where: { id: accountId, userId, deletedAt: null },
    });
    if (!acc) throw new NotFoundException('Email account not found.');

    let total = 0;
    const byFolder: Record<string, number> = {};

    for (const f of folders) {
      let fetched: {
        externalMessageId: string;
        subject: string;
        fromAddr: string;
        snippet: string;
        bodyPreview: string;
        receivedAt: Date;
      }[] | null;
      try {
        fetched =
          acc.provider === EmailAccountProvider.GMAIL_API
            ? await this.oauthMail.fetchGmailMessages(acc, f, 80)
            : acc.provider === EmailAccountProvider.OUTLOOK
              ? await this.oauthMail.fetchGraphMessages(acc, f, 80)
              : acc.provider === EmailAccountProvider.SMTP && this.imapSync.hasImapCredentials(acc)
                ? await this.imapSync.fetchMailboxMessages(acc, f, 80)
                : null;
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        this.log.error(`syncMailbox fetch failed folder=${f} account=${accountId}`, e);
        throw new BadRequestException(`Sync failed for folder “${f}”: ${msg}`);
      }

      if (fetched === null) {
        throw new BadRequestException(
          'Mailbox sync needs a Gmail/Outlook OAuth account, or an SMTP account with IMAP host, port, user, and password saved.',
        );
      }
      const rows = fetched;

      let n = 0;
      for (const r of rows) {
        const ext = safeExternalMessageId(r.externalMessageId);
        const subj = truncateInboxField(r.subject, 2000);
        const from = truncateInboxField(r.fromAddr, 2000);
        const snip = truncateInboxField(r.snippet, 4000);
        const prev = truncateInboxField(r.bodyPreview, 8000);
        let receivedAt = r.receivedAt instanceof Date ? r.receivedAt : new Date(r.receivedAt);
        if (Number.isNaN(receivedAt.getTime())) receivedAt = new Date();

        try {
          await this.prisma.inboxMessage.upsert({
            where: {
              emailAccountId_externalMessageId: {
                emailAccountId: acc.id,
                externalMessageId: ext,
              },
            },
            create: {
              userId,
              emailAccountId: acc.id,
              externalMessageId: ext,
              folder: f,
              subject: subj,
              fromAddr: from,
              snippet: snip,
              bodyPreview: prev,
              receivedAt,
            },
            update: {
              folder: f,
              subject: subj,
              fromAddr: from,
              snippet: snip,
              bodyPreview: prev,
              receivedAt,
            },
          });
          n++;
        } catch (e) {
          this.log.warn(`inbox upsert skip ext=${ext.slice(0, 80)}`, e);
        }
      }
      byFolder[f] = n;
      total += n;
    }

    return {
      synced: total,
      byFolder,
      folder: raw === 'all' ? 'all' : folders[0],
      accountId: acc.id,
    };
  }
}
