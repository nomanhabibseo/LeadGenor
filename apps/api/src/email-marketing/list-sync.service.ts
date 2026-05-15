import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailListAutoUpdate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailListsService } from './email-lists.service';

@Injectable()
export class ListSyncService {
  private readonly log = new Logger(ListSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lists: EmailListsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailySync() {
    const lists = await this.prisma.emailList.findMany({
      where: {
        deletedAt: null,
        autoUpdate: { not: EmailListAutoUpdate.OFF },
      },
    });
    for (const l of lists) {
      try {
        if (l.autoUpdate === EmailListAutoUpdate.DAILY) {
          await this.lists.syncListFromDatabanks(l.userId, l.id);
        }
      } catch (e) {
        this.log.warn(`List sync failed ${l.id}`, e);
      }
    }
  }

  @Cron('0 4 * * 0')
  async weeklySync() {
    const lists = await this.prisma.emailList.findMany({
      where: { deletedAt: null, autoUpdate: EmailListAutoUpdate.WEEKLY },
    });
    for (const l of lists) {
      try {
        await this.lists.syncListFromDatabanks(l.userId, l.id);
      } catch (e) {
        this.log.warn(`Weekly list sync failed ${l.id}`, e);
      }
    }
  }

  @Cron('0 3 1 * *')
  async monthlySync() {
    const lists = await this.prisma.emailList.findMany({
      where: { deletedAt: null, autoUpdate: EmailListAutoUpdate.MONTHLY },
    });
    for (const l of lists) {
      try {
        await this.lists.syncListFromDatabanks(l.userId, l.id);
      } catch (e) {
        this.log.warn(`Monthly list sync failed ${l.id}`, e);
      }
    }
  }
}
