import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { CampaignRecipientStatus } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function unsubShell(title: string, inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem">${inner}</body></html>`;
}

function unsubCard(content: string): string {
  return `<div style="max-width:420px;width:100%;background:#fff;border-radius:16px;padding:1.75rem 1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.35)">${content}</div>`;
}

@Controller('public')
export class PublicEmailController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('unsubscribe')
  async unsubscribe(@Query('t') token: string | undefined, @Query('confirm') confirm: string | undefined, @Res() res: Response) {
    if (!token?.trim()) {
      return res.status(400).send('Invalid link.');
    }
    const tok = token.trim();
    const row = await this.prisma.unsubscribeToken.findUnique({ where: { token: tok } });
    if (!row) {
      return res.status(404).send('This unsubscribe link is invalid or expired.');
    }

    const enc = encodeURIComponent(tok);
    const yesHref = `/public/unsubscribe?t=${enc}&confirm=yes`;
    const noHref = `/public/unsubscribe?t=${enc}&confirm=no`;

    if (confirm === 'yes') {
      await this.prisma.emailSuppression.upsert({
        where: {
          userId_emailNorm: { userId: row.userId, emailNorm: row.emailNorm },
        },
        create: { userId: row.userId, emailNorm: row.emailNorm, reason: 'unsubscribe' },
        update: {},
      });
      await this.prisma.campaignRecipient.updateMany({
        where: {
          campaign: { userId: row.userId },
          targetEmail: { equals: row.emailNorm, mode: 'insensitive' },
        },
        data: {
          status: CampaignRecipientStatus.UNSUBSCRIBED,
          nextSendAt: null,
          nextMainSendAt: null,
          nextFollowupSendAt: null,
          followupPhase: 'done',
        },
      });
      const inner = unsubCard(
        `<h1 style="margin:0 0 0.75rem;font-size:1.25rem;color:#0f172a">You are unsubscribed</h1><p style="margin:0;color:#475569;line-height:1.5">You will not receive further marketing emails from this sender at this address.</p>`,
      );
      return res.type('html').send(unsubShell('Unsubscribed', inner));
    }

    if (confirm === 'no') {
      const inner = unsubCard(
        `<h1 style="margin:0 0 0.75rem;font-size:1.25rem;color:#0f172a">No change</h1><p style="margin:0;color:#475569;line-height:1.5">You have not been unsubscribed. You may close this page.</p>`,
      );
      return res.type('html').send(unsubShell('Unsubscribe', inner));
    }

    const inner = unsubCard(
      `<h1 style="margin:0 0 0.75rem;font-size:1.25rem;color:#0f172a">Unsubscribe from emails?</h1>
       <p style="margin:0 0 1.25rem;color:#475569;line-height:1.5">Do you want to unsubscribe from future emails from this sender at this address?</p>
       <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:flex-end">
         <a href="${noHref}" style="display:inline-block;padding:0.6rem 1rem;border-radius:10px;border:1px solid #cbd5e1;color:#334155;font-weight:600;text-decoration:none">No, keep me subscribed</a>
         <a href="${yesHref}" style="display:inline-block;padding:0.6rem 1rem;border-radius:10px;background:#2563eb;color:#fff;font-weight:600;text-decoration:none">Yes, unsubscribe</a>
       </div>`,
    );
    return res.type('html').send(unsubShell('Confirm unsubscribe', inner));
  }

  @Get('email/open/:recipientId')
  async open(@Param('recipientId') recipientId: string, @Res() res: Response) {
    const r = await this.prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
    if (!r) throw new NotFoundException();
    await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { opened: true },
    });
    await this.prisma.emailOpenEvent.create({ data: { recipientId } });
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(PIXEL);
  }
}
