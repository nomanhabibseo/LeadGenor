import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailAccount, EmailAccountProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from './crypto-secret';
import { htmlToPlainText } from './email-html-plain';

export type MailboxFolder = 'inbox' | 'sent' | 'drafts';

@Injectable()
export class EmailOAuthMailService {
  private readonly log = new Logger(EmailOAuthMailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private msTenant() {
    return process.env.MICROSOFT_OAUTH_TENANT || 'common';
  }

  /** Returns valid access token; refreshes and persists when near expiry. */
  async ensureAccessToken(acc: EmailAccount): Promise<string> {
    if (!acc.oauthRefreshEnc) throw new BadRequestException('Account has no OAuth refresh token.');
    const refresh = decryptSecret(acc.oauthRefreshEnc);
    const skew = 120_000;
    if (
      acc.oauthAccessEnc &&
      acc.oauthExpiresAt &&
      acc.oauthExpiresAt.getTime() > Date.now() + skew
    ) {
      return decryptSecret(acc.oauthAccessEnc);
    }
    if (acc.provider === EmailAccountProvider.GMAIL_API) {
      return this.refreshGoogle(acc, refresh);
    }
    if (acc.provider === EmailAccountProvider.OUTLOOK) {
      return this.refreshMicrosoft(acc, refresh);
    }
    throw new BadRequestException('OAuth token refresh is only supported for Gmail and Outlook accounts.');
  }

  private async refreshGoogle(acc: EmailAccount, refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new BadRequestException('Google OAuth is not configured on the server.');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Google token refresh failed: ${res.status} ${t}`);
      throw new BadRequestException('Could not refresh Google access token. Re-connect the account.');
    }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    const accessEnc = encryptSecret(j.access_token);
    const oauthExpiresAt = new Date(Date.now() + j.expires_in * 1000);
    await this.prisma.emailAccount.update({
      where: { id: acc.id },
      data: { oauthAccessEnc: accessEnc, oauthExpiresAt },
    });
    return j.access_token;
  }

  private async refreshMicrosoft(acc: EmailAccount, refreshToken: string): Promise<string> {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    const tenant = this.msTenant();
    if (!clientId || !clientSecret) throw new BadRequestException('Microsoft OAuth is not configured on the server.');
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Microsoft token refresh failed: ${res.status} ${t}`);
      throw new BadRequestException('Could not refresh Microsoft access token. Re-connect the account.');
    }
    const j = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
    const accessEnc = encryptSecret(j.access_token);
    const oauthExpiresAt = new Date(Date.now() + j.expires_in * 1000);
    const data: { oauthAccessEnc: string; oauthExpiresAt: Date; oauthRefreshEnc?: string } = {
      oauthAccessEnc: accessEnc,
      oauthExpiresAt,
    };
    if (j.refresh_token) {
      data.oauthRefreshEnc = encryptSecret(j.refresh_token);
    }
    await this.prisma.emailAccount.update({ where: { id: acc.id }, data });
    return j.access_token;
  }

  private toBase64Url(s: string): string {
    return Buffer.from(s, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private wrap76(s: string): string {
    const parts: string[] = [];
    for (let i = 0; i < s.length; i += 76) parts.push(s.slice(i, i + 76));
    return parts.join('\r\n');
  }

  /**
   * multipart/alternative (plain + html) matches what many clients send for “normal” mail and
   * can reduce Promotions-tab classification vs HTML-only bulk-looking messages (not guaranteed).
   */
  private buildGmailMultipartRfc822(
    acc: EmailAccount,
    opts: {
      to: string;
      subject: string;
      html: string;
      text: string;
      listUnsubscribe?: string;
      bcc?: string;
    },
  ): string {
    const boundary = `bnd_${randomBytes(16).toString('hex')}`;
    const subject = this.mimeEncodeSubject(opts.subject);
    const textB64 = this.wrap76(Buffer.from(opts.text, 'utf8').toString('base64'));
    const htmlB64 = this.wrap76(Buffer.from(opts.html, 'utf8').toString('base64'));
    const lines: string[] = [
      `From: "${acc.displayName.replace(/"/g, '')}" <${acc.fromEmail}>`,
      `To: ${opts.to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    if (opts.bcc?.trim()) lines.push(`Bcc: ${opts.bcc.trim()}`);
    if (opts.listUnsubscribe?.trim()) {
      lines.push(`List-Unsubscribe: <${opts.listUnsubscribe.trim()}>`);
      lines.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    }
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(textB64);
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(htmlB64);
    lines.push(`--${boundary}--`);
    return lines.join('\r\n');
  }

  async sendGmail(
    acc: EmailAccount,
    opts: {
      to: string;
      subject: string;
      html: string;
      /** If omitted, derived from html via htmlToPlainText (multipart still sent). */
      text?: string;
      listUnsubscribe?: string;
      bcc?: string;
    },
  ): Promise<void> {
    const access = await this.ensureAccessToken(acc);
    const text = opts.text?.trim() || htmlToPlainText(opts.html) || ' ';
    const rfc822 = this.buildGmailMultipartRfc822(acc, {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text,
      listUnsubscribe: opts.listUnsubscribe,
      bcc: opts.bcc,
    });
    const raw = this.toBase64Url(rfc822);
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      this.log.warn(`Gmail send failed: ${sendRes.status} ${t}`);
      throw new BadRequestException('Gmail rejected the send request.');
    }
  }

  private mimeEncodeSubject(subject: string): string {
    if (/^[\x20-\x7E]*$/.test(subject)) return subject;
    return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  }

  async sendMicrosoftGraph(
    acc: EmailAccount,
    opts: { to: string; subject: string; html: string; listUnsubscribe?: string; bcc?: string },
  ): Promise<void> {
    const access = await this.ensureAccessToken(acc);
    const internetMessageHeaders: { name: string; value: string }[] = [];
    if (opts.listUnsubscribe?.trim()) {
      internetMessageHeaders.push({ name: 'List-Unsubscribe', value: `<${opts.listUnsubscribe.trim()}>` });
    }
    const message: Record<string, unknown> = {
      subject: opts.subject,
      body: { contentType: 'HTML', content: opts.html },
      toRecipients: [{ emailAddress: { address: opts.to } }],
    };
    if (opts.bcc?.trim()) {
      message.bccRecipients = opts.bcc.split(/[,;\s]+/).filter(Boolean).map((a) => ({ emailAddress: { address: a } }));
    }
    if (internetMessageHeaders.length) message.internetMessageHeaders = internetMessageHeaders;
    const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      this.log.warn(`Graph sendMail failed: ${sendRes.status} ${t}`);
      throw new BadRequestException('Microsoft Graph rejected the send request.');
    }
  }

  gmailLabelForFolder(folder: MailboxFolder): string {
    switch (folder) {
      case 'sent':
        return 'SENT';
      case 'drafts':
        return 'DRAFT';
      default:
        return 'INBOX';
    }
  }

  graphFolderPath(folder: MailboxFolder): string {
    switch (folder) {
      case 'sent':
        return 'sentitems';
      case 'drafts':
        return 'drafts';
      default:
        return 'inbox';
    }
  }

  async fetchGmailMessages(
    acc: EmailAccount,
    folder: MailboxFolder,
    maxResults: number,
  ): Promise<
    { externalMessageId: string; subject: string; fromAddr: string; snippet: string; receivedAt: Date; bodyPreview: string }[]
  > {
    const access = await this.ensureAccessToken(acc);
    const label = this.gmailLabelForFolder(folder);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${encodeURIComponent(label)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${access}` } },
    );
    if (!listRes.ok) {
      const t = await listRes.text();
      this.log.warn(`Gmail list failed: ${listRes.status} ${t}`);
      throw new BadRequestException('Could not list Gmail messages. Check OAuth scopes include gmail.readonly.');
    }
    const listJson = (await listRes.json()) as { messages?: { id: string }[] };
    const ids = listJson.messages ?? [];
    const out: {
      externalMessageId: string;
      subject: string;
      fromAddr: string;
      snippet: string;
      receivedAt: Date;
      bodyPreview: string;
    }[] = [];
    for (const { id } of ids.slice(0, maxResults)) {
      const getRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${access}` } },
      );
      if (!getRes.ok) continue;
      const msg = (await getRes.json()) as {
        id: string;
        snippet?: string;
        internalDate?: string;
        payload?: { headers?: { name: string; value: string }[] };
      };
      let subject = '';
      let fromAddr = '';
      let dateHdr = '';
      for (const h of msg.payload?.headers ?? []) {
        const n = h.name.toLowerCase();
        if (n === 'subject') subject = h.value || '';
        if (n === 'from') fromAddr = h.value || '';
        if (n === 'date') dateHdr = h.value || '';
      }
      const receivedAt = msg.internalDate
        ? new Date(Number(msg.internalDate))
        : dateHdr
          ? new Date(dateHdr)
          : new Date();
      const snippet = msg.snippet ?? '';
      out.push({
        externalMessageId: msg.id,
        subject,
        fromAddr,
        snippet,
        receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
        bodyPreview: snippet.slice(0, 500),
      });
    }
    return out;
  }

  async fetchGraphMessages(
    acc: EmailAccount,
    folder: MailboxFolder,
    maxResults: number,
  ): Promise<
    { externalMessageId: string; subject: string; fromAddr: string; snippet: string; receivedAt: Date; bodyPreview: string }[]
  > {
    const access = await this.ensureAccessToken(acc);
    const wellKnown = this.graphFolderPath(folder);
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${wellKnown}/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,subject,from,bodyPreview,receivedDateTime,snippet`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Graph list messages failed: ${res.status} ${t}`);
      throw new BadRequestException('Could not list Outlook messages. Check Mail.Read scope.');
    }
    const j = (await res.json()) as {
      value?: {
        id: string;
        subject?: string;
        from?: { emailAddress?: { address?: string; name?: string } };
        bodyPreview?: string;
        receivedDateTime?: string;
        snippet?: string;
      }[];
    };
    const rows = j.value ?? [];
    return rows.map((m) => {
      const fromAddr =
        m.from?.emailAddress?.name && m.from?.emailAddress?.address
          ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
          : m.from?.emailAddress?.address ?? '';
      const receivedAt = m.receivedDateTime ? new Date(m.receivedDateTime) : new Date();
      const snippet = m.snippet ?? m.bodyPreview ?? '';
      return {
        externalMessageId: m.id,
        subject: m.subject ?? '',
        fromAddr,
        snippet,
        receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
        bodyPreview: (m.bodyPreview ?? snippet).slice(0, 500),
      };
    });
  }
}
