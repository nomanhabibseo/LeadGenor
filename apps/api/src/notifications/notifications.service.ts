import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateNotificationInput = {
  kind?: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  href?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get repo() {
    // Prisma client typings won’t include Notification until migrations+generate run.
    return (this.prisma as unknown as { notification: any }).notification;
  }

  async create(userId: string, input: CreateNotificationInput) {
    return this.repo.create({
      data: {
        userId,
        kind: input.kind ?? 'info',
        title: input.title.trim().slice(0, 200),
        message: (input.message ?? '').trim().slice(0, 4000),
        href: input.href?.trim() || null,
      },
      select: {
        id: true,
        kind: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async list(userId: string, take = 50) {
    return this.repo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, take), 200),
      select: {
        id: true,
        kind: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async unreadCount(userId: string) {
    const n = await this.repo.count({ where: { userId, readAt: null } });
    return { unread: n };
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.findFirst({ where: { id, userId } });
    if (!row) return { ok: false };
    if (row.readAt) return { ok: true };
    await this.repo.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const r = await this.repo.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true, updated: r.count as number };
  }
}

