import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { EmailAccountProvider } from '@prisma/client';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { IsEmail, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAccountsService } from './email-accounts.service';
import { encryptSecret } from './crypto-secret';

class CompleteOAuthDto {
  @IsString()
  pendingId!: string;

  @IsEmail()
  email!: string;
}

/**
 * OAuth entry points for Gmail / Outlook. Callback exchanges the code server-side,
 * then redirects to the web app (account list or address picker).
 */
@Controller('email-marketing/oauth')
export class OauthProvidersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: EmailAccountsService,
  ) {}

  private webOrigin() {
    return process.env.WEB_ORIGIN || 'http://localhost:3000';
  }

  /**
   * Reports whether OAuth env is present on the API (no OAuth state created).
   * Secrets are required so the callback can exchange the code.
   */
  @Get('config')
  @UseGuards(JwtAuthGuard)
  oauthConfig() {
    const gId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const gSec = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    const gRedir = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
    const mId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
    const mSec = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
    const mRedir = process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim();
    return {
      google: !!(gId && gSec && gRedir),
      microsoft: !!(mId && mSec && mRedir),
    };
  }

  /** Returns JSON `{ url }` for SPA clients (use with Authorization header). */
  @Get('google/url')
  @UseGuards(JwtAuthGuard)
  async googleUrl(@CurrentUser() user: JwtUser) {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!clientId || !redirect) {
      return { error: 'Google OAuth is not configured.' };
    }
    const state = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.oAuthState.create({
      data: { userId: user.userId, provider: 'google', state, expiresAt },
    });
    const scope = encodeURIComponent(
      [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'openid',
      ].join(' '),
    );
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${scope}` +
      `&access_type=offline&prompt=consent&state=${state}`;
    return { url };
  }

  @Get('google/start')
  @UseGuards(JwtAuthGuard)
  async googleStart(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const r = await this.googleUrl(user);
    if ('error' in r && r.error) {
      return res.status(503).json({ error: r.error });
    }
    return res.redirect((r as { url: string }).url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const web = this.webOrigin();
    if (!code || !state) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=missing`);
    }
    const row = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!row || row.expiresAt < new Date()) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=state`);
    }
    await this.prisma.oAuthState.delete({ where: { id: row.id } });

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirect) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=config`);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=token`);
    }
    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token: string;
      expires_in: number;
    };
    if (!tokens.refresh_token) {
      return res.redirect(`${web}/email-marketing/accounts/add?oauthError=norefresh`);
    }
    const accessExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const refreshEnc = encryptSecret(tokens.refresh_token);
    const accessEnc = encryptSecret(tokens.access_token);

    const uir = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await uir.json()) as { email?: string; name?: string };

    let candidates: { email: string; displayName: string }[] = [];
    const sar = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (sar.ok) {
      const sendAsData = (await sar.json()) as {
        sendAs?: { sendAsEmail: string; displayName?: string; verificationStatus?: string }[];
      };
      candidates = (sendAsData.sendAs ?? [])
        .filter((s) => s.verificationStatus === 'accepted')
        .map((s) => ({
          email: s.sendAsEmail,
          displayName: (s.displayName || s.sendAsEmail).trim(),
        }));
    }
    if (!candidates.length && profile.email) {
      candidates = [{ email: profile.email, displayName: (profile.name ?? profile.email).trim() }];
    }
    if (!candidates.length) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=noemail`);
    }

    if (candidates.length === 1) {
      await this.accounts.createOAuthAccountLinked(row.userId, {
        provider: EmailAccountProvider.GMAIL_API,
        refreshTokenEnc: refreshEnc,
        accessTokenEnc: accessEnc,
        accessExpiresAt,
        fromEmail: candidates[0].email,
        displayName: candidates[0].displayName,
      });
      return res.redirect(`${web}/email-marketing/accounts?oauth=google`);
    }

    const pending = await this.prisma.emailOAuthPending.create({
      data: {
        userId: row.userId,
        provider: 'google',
        refreshTokenEnc: refreshEnc,
        accessTokenEnc: accessEnc,
        accessExpiresAt,
        candidates,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return res.redirect(`${web}/email-marketing/accounts/oauth/pick?pending=${pending.id}`);
  }

  @Get('microsoft/url')
  @UseGuards(JwtAuthGuard)
  async microsoftUrl(@CurrentUser() user: JwtUser) {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const redirect = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
    const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
    if (!clientId || !redirect) {
      return { error: 'Microsoft OAuth is not configured.' };
    }
    const state = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.oAuthState.create({
      data: { userId: user.userId, provider: 'microsoft', state, expiresAt },
    });
    const scope = encodeURIComponent(
      'offline_access Mail.Send Mail.Read User.Read openid email profile',
    );
    const url =
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${scope}&state=${state}`;
    return { url };
  }

  @Get('microsoft/start')
  @UseGuards(JwtAuthGuard)
  async microsoftStart(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const r = await this.microsoftUrl(user);
    if ('error' in r && r.error) {
      return res.status(503).json({ error: r.error });
    }
    return res.redirect((r as { url: string }).url);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const web = this.webOrigin();
    if (!code || !state) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=missing`);
    }
    const row = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!row || row.expiresAt < new Date()) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=state`);
    }
    await this.prisma.oAuthState.delete({ where: { id: row.id } });

    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    const redirect = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
    const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
    if (!clientId || !clientSecret || !redirect) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=config`);
    }

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
      },
    );
    if (!tokenRes.ok) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=token`);
    }
    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token: string;
      expires_in: number;
    };
    if (!tokens.refresh_token) {
      return res.redirect(`${web}/email-marketing/accounts/add?oauthError=norefresh`);
    }
    const accessExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const refreshEnc = encryptSecret(tokens.refresh_token);
    const accessEnc = encryptSecret(tokens.access_token);

    const meRes = await fetch(
      'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails,displayName',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!meRes.ok) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=profile`);
    }
    const me = (await meRes.json()) as {
      mail?: string | null;
      userPrincipalName?: string;
      otherMails?: string[];
      displayName?: string;
    };
    const raw: { email: string; displayName: string }[] = [];
    const push = (email: string | null | undefined, displayName: string) => {
      if (email && /^[^\s@]+@[^\s@]+$/.test(email)) {
        raw.push({ email: email.trim(), displayName });
      }
    };
    push(me.mail, me.displayName ?? me.mail ?? '');
    push(me.userPrincipalName, me.displayName ?? me.userPrincipalName ?? '');
    for (const o of me.otherMails ?? []) push(o, me.displayName ?? o);
    const seen = new Set<string>();
    const candidates: { email: string; displayName: string }[] = [];
    for (const r of raw) {
      const k = r.email.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      candidates.push({ email: r.email, displayName: r.displayName || r.email });
    }
    if (!candidates.length) {
      return res.redirect(`${web}/email-marketing/accounts?oauthError=noemail`);
    }

    if (candidates.length === 1) {
      await this.accounts.createOAuthAccountLinked(row.userId, {
        provider: EmailAccountProvider.OUTLOOK,
        refreshTokenEnc: refreshEnc,
        accessTokenEnc: accessEnc,
        accessExpiresAt,
        fromEmail: candidates[0].email,
        displayName: candidates[0].displayName,
      });
      return res.redirect(`${web}/email-marketing/accounts?oauth=microsoft`);
    }

    const pending = await this.prisma.emailOAuthPending.create({
      data: {
        userId: row.userId,
        provider: 'microsoft',
        refreshTokenEnc: refreshEnc,
        accessTokenEnc: accessEnc,
        accessExpiresAt,
        candidates,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return res.redirect(`${web}/email-marketing/accounts/oauth/pick?pending=${pending.id}`);
  }

  @Get('pending/:pendingId')
  @UseGuards(JwtAuthGuard)
  async getPending(@CurrentUser() user: JwtUser, @Param('pendingId') pendingId: string) {
    return this.accounts.getOAuthPending(user.userId, pendingId);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  async complete(@CurrentUser() user: JwtUser, @Body() body: CompleteOAuthDto) {
    const acc = await this.accounts.completeOAuthPending(user.userId, body.pendingId, body.email);
    return this.accounts.maskAccount(acc);
  }
}
