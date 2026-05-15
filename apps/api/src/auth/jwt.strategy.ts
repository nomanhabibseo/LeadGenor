import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /** Coalesce concurrent `/users/me` validations (same `sub`) to one DB read — avoids pool starvation with small pools. */
  private readonly userLoadBySubject = new Map<string, Promise<{ userId: string; email: string }>>();
  /** Short TTL cache so every API request does not hit Prisma (critical when imports hold connections). */
  private readonly userCache = new Map<string, { at: number; user: { userId: string; email: string } }>();
  private readonly userCacheTtlMs = 25_000;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<{ userId: string; email: string }> {
    const key = payload.sub;
    const now = Date.now();
    const cached = this.userCache.get(key);
    if (cached && now - cached.at < this.userCacheTtlMs) {
      return cached.user;
    }

    let inflight = this.userLoadBySubject.get(key);
    if (!inflight) {
      inflight = (async () => {
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) throw new UnauthorizedException();
        return { userId: user.id, email: user.email };
      })().finally(() => {
        const cur = this.userLoadBySubject.get(key);
        if (cur === inflight) this.userLoadBySubject.delete(key);
      });
      this.userLoadBySubject.set(key, inflight);
    }
    try {
      const user = await inflight;
      this.userCache.set(key, { at: now, user });
      return user;
    } catch (e) {
      this.userCache.delete(key);
      throw e;
    }
  }
}
