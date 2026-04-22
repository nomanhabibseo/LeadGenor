import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailAccount, EmailAccountProvider, SmtpEncryption } from '@prisma/client';
import { ImapFlow, type FetchMessageObject, type ListResponse } from 'imapflow';
import { decryptSecret } from './crypto-secret';

function stripNul(s: string): string {
  return s.replace(/\u0000/g, '');
}

/** `instanceof AuthenticationFailure` breaks under some Nest/webpack builds (RHS not an object). */
function isImapAuthenticationFailure(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'authenticationFailed' in e &&
    (e as { authenticationFailed?: boolean }).authenticationFailed === true
  );
}
import type { MailboxFolder } from './email-oauth-mail.service';

export type ImapInboxRow = {
  externalMessageId: string;
  subject: string;
  fromAddr: string;
  snippet: string;
  receivedAt: Date;
  bodyPreview: string;
};

function formatFromAddr(env: FetchMessageObject['envelope']): string {
  const f = env?.from?.[0];
  if (!f) return '';
  if (f.name && f.address) return `${f.name} <${f.address}>`;
  return f.address ?? '';
}

function normalizeMessageId(raw: string): string {
  return raw.replace(/^<|>$/g, '').replace(/\s+/g, ' ').slice(0, 240);
}

function buildExternalId(
  msg: FetchMessageObject,
  mailboxPath: string,
  uidValidity: bigint | undefined,
): string {
  if (msg.emailId != null && msg.emailId !== '') return `gimap:${String(msg.emailId)}`;
  const mid = msg.envelope?.messageId?.trim();
  if (mid) return `mid:${normalizeMessageId(mid)}`;
  const v = uidValidity !== undefined ? String(uidValidity) : '0';
  return `imap:${mailboxPath}:${v}:${msg.uid}`;
}

function pickMailboxPath(list: ListResponse[], folder: MailboxFolder): string {
  const bySpecial = (su: string) => list.find((m) => m.specialUse === su)?.path;
  if (folder === 'inbox') {
    return (
      bySpecial('\\Inbox') ??
      list.find((m) => /^INBOX$/i.test(m.path))?.path ??
      'INBOX'
    );
  }
  if (folder === 'sent') {
    const p =
      bySpecial('\\Sent') ??
      list.find((m) => /(^|\/)sent(\s|$|\/)/i.test(m.path) && !/draft/i.test(m.path))?.path ??
      list.find((m) => m.path.includes('[Gmail]/Sent Mail'))?.path ??
      list.find((m) => /sent mail/i.test(m.path))?.path;
    if (p) return p;
  }
  if (folder === 'drafts') {
    const p =
      bySpecial('\\Drafts') ??
      list.find((m) => /draft/i.test(m.path) && !/template/i.test(m.path))?.path;
    if (p) return p;
  }
  const hint = folder === 'sent' ? 'Sent' : folder === 'drafts' ? 'Drafts' : 'Inbox';
  const sample = list
    .slice(0, 12)
    .map((m) => m.path)
    .join(', ');
  throw new BadRequestException(
    `Could not find a ${hint} folder on this IMAP server. Known folders: ${sample || '(none)'}.`,
  );
}

function imapImplicitTls(port: number, enc: SmtpEncryption): boolean {
  if (enc === SmtpEncryption.SSL) return true;
  if (enc === SmtpEncryption.TLS && port === 993) return true;
  return port === 993;
}

@Injectable()
export class EmailImapSyncService {
  private readonly log = new Logger(EmailImapSyncService.name);

  hasImapCredentials(acc: Pick<EmailAccount, 'provider' | 'imapHost' | 'imapPort' | 'imapUser' | 'imapPasswordEnc'>): boolean {
    return (
      acc.provider === EmailAccountProvider.SMTP &&
      !!acc.imapHost?.trim() &&
      !!acc.imapPort &&
      !!acc.imapUser?.trim() &&
      !!acc.imapPasswordEnc
    );
  }

  async fetchMailboxMessages(acc: EmailAccount, folder: MailboxFolder, limit: number): Promise<ImapInboxRow[]> {
    if (!this.hasImapCredentials(acc)) {
      throw new BadRequestException(
        'Add IMAP host, port, username, and password to this SMTP account (Edit account) to enable mailbox sync.',
      );
    }
    let pass: string;
    try {
      pass = decryptSecret(acc.imapPasswordEnc!);
    } catch (e) {
      this.log.warn('IMAP password decrypt failed', e);
      throw new BadRequestException(
        'Could not decrypt the saved IMAP password. Open the account in Email settings, re-enter the IMAP password, and save.',
      );
    }
    const port = acc.imapPort!;
    const host = acc.imapHost!.trim();
    const user = acc.imapUser!.trim();
    const secure = imapImplicitTls(port, acc.imapEncryption);
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 60_000,
      greetingTimeout: 30_000,
      socketTimeout: 120_000,
    });
    try {
      await client.connect();
    } catch (e) {
      if (isImapAuthenticationFailure(e)) {
        this.log.warn(`IMAP auth failed for ${host}:${port} user=${user}`);
        throw new BadRequestException('IMAP login failed. Check IMAP username, password, and encryption/port (993 TLS vs 143 STARTTLS).');
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`IMAP connect failed ${host}:${port}: ${msg}`);
      throw new BadRequestException(`Could not connect to IMAP (${host}:${port}). ${msg}`);
    }

    try {
      let list: ListResponse[];
      try {
        list = await client.list();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new BadRequestException(`IMAP LIST failed: ${msg}`);
      }

      const mailboxPath = pickMailboxPath(list, folder);
      const lock = await client.getMailboxLock(mailboxPath, { readOnly: true });
      try {
        const mb = client.mailbox;
        if (mb === false) {
          return [];
        }
        if (!mb.exists) {
          return [];
        }
        const uidValidity = mb.uidValidity;
        const uidsRes = await client.search({ all: true }, { uid: true });
        const uidsAll = uidsRes === false ? [] : uidsRes;
        if (!uidsAll.length) return [];
        const cap = Math.min(Math.max(limit, 1), 200);
        const uids = uidsAll.slice(-cap);
        const out: ImapInboxRow[] = [];
        try {
          for await (const msg of client.fetch(uids, { envelope: true, internalDate: true, uid: true }, { uid: true })) {
            const rawSub = msg.envelope?.subject;
            const subject = typeof rawSub === 'string' ? stripNul(rawSub) : '';
            const fromAddr = stripNul(formatFromAddr(msg.envelope));
            let receivedAt = new Date();
            if (msg.internalDate) {
              receivedAt = msg.internalDate instanceof Date ? msg.internalDate : new Date(msg.internalDate);
            } else if (msg.envelope?.date) {
              receivedAt =
                msg.envelope.date instanceof Date ? msg.envelope.date : new Date(msg.envelope.date as unknown as string);
            }
            if (Number.isNaN(receivedAt.getTime())) receivedAt = new Date();
            const snippet = stripNul(subject ? subject.slice(0, 240) : fromAddr ? `From ${fromAddr}` : '');
            out.push({
              externalMessageId: stripNul(buildExternalId(msg, mailboxPath, uidValidity)),
              subject,
              fromAddr,
              snippet,
              receivedAt,
              bodyPreview: snippet.slice(0, 500),
            });
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          this.log.warn(`IMAP FETCH failed ${host} path=${mailboxPath}`, e);
          throw new BadRequestException(`IMAP fetch failed: ${err}`);
        }
        return out;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Plain-password IMAP check before account is saved (no DB row). */
  async verifyImapPlain(params: {
    imapHost: string;
    imapPort: number;
    imapUser: string;
    imapPassword: string;
    imapEncryption: SmtpEncryption;
  }): Promise<void> {
    const host = params.imapHost.trim();
    const port = params.imapPort;
    const user = params.imapUser.trim();
    const pass = params.imapPassword;
    const secure = imapImplicitTls(port, params.imapEncryption);
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 45_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
    });
    try {
      await client.connect();
      await client.list();
    } catch (e) {
      if (isImapAuthenticationFailure(e)) {
        throw new BadRequestException(
          'IMAP: The username or password you entered is incorrect. Please enter the correct credentials.',
        );
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`IMAP connection failed: ${msg}`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Connect and run LIST to confirm IMAP credentials (used after SMTP verify). */
  async verifyImap(acc: EmailAccount): Promise<void> {
    if (!this.hasImapCredentials(acc)) return;
    let pass: string;
    try {
      pass = decryptSecret(acc.imapPasswordEnc!);
    } catch {
      throw new BadRequestException(
        'Could not decrypt the saved IMAP password. Re-enter the IMAP password on the account and save, then verify again.',
      );
    }
    const port = acc.imapPort!;
    const host = acc.imapHost!.trim();
    const user = acc.imapUser!.trim();
    const secure = imapImplicitTls(port, acc.imapEncryption);
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 45_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
    });
    try {
      await client.connect();
      await client.list();
    } catch (e) {
      if (isImapAuthenticationFailure(e)) {
        throw new BadRequestException('IMAP login failed. Check IMAP username, password, and encryption/port.');
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`IMAP check failed: ${msg}`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}
