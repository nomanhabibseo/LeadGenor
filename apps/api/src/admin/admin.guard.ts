import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const DEV_FALLBACK_ADMINS = new Set(['nomanhabib.seo@gmail.com']);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const email = String(req?.user?.email ?? '').trim().toLowerCase();
    const configured = parseAdminEmails(this.config.get<string>('ADMIN_EMAILS'));
    const env = (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development').toLowerCase();
    const allowed =
      configured.size > 0 ? configured : env !== 'production' ? DEV_FALLBACK_ADMINS : configured;
    if (!email) throw new ForbiddenException('Admin access required.');
    if (allowed.size === 0) {
      throw new ForbiddenException('Admin access is not configured (ADMIN_EMAILS).');
    }
    if (!allowed.has(email)) {
      throw new ForbiddenException('Admin access required.');
    }
    return true;
  }
}

