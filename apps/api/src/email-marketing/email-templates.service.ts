import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function collectTemplateIdsFromFlow(nodes: unknown): string[] {
  const ids: string[] = [];
  if (!Array.isArray(nodes)) return ids;
  for (const raw of nodes) {
    const n = raw as Record<string, unknown>;
    if (!n || typeof n !== 'object') continue;
    if (n.t === 'email' && typeof n.templateId === 'string' && n.templateId.trim()) {
      ids.push(n.templateId.trim());
    }
    if (n.t === 'condition') {
      ids.push(...collectTemplateIdsFromFlow(n.yes));
      ids.push(...collectTemplateIdsFromFlow(n.no));
    }
  }
  return ids;
}

function templateIdsUsedInCampaign(c: {
  mainSequence: unknown;
  followUpSequence: unknown;
  mainFlowGraph: unknown;
}): Set<string> {
  const s = new Set<string>();
  const main = c.mainSequence as { templateId?: string }[] | null;
  if (Array.isArray(main)) {
    for (const row of main) {
      if (row?.templateId) s.add(String(row.templateId));
    }
  }
  const fol = c.followUpSequence as { templateId?: string }[] | null;
  if (Array.isArray(fol)) {
    for (const row of fol) {
      if (row?.templateId) s.add(String(row.templateId));
    }
  }
  for (const id of collectTemplateIdsFromFlow(c.mainFlowGraph)) s.add(id);
  return s;
}

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private async templateUseCounts(userId: string): Promise<Map<string, number>> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { userId, deletedAt: null },
      select: { mainSequence: true, followUpSequence: true, mainFlowGraph: true },
    });
    const map = new Map<string, number>();
    for (const c of campaigns) {
      for (const id of templateIdsUsedInCampaign(c)) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }

  private async assertFolderNameUnique(userId: string, name: string, excludeFolderId?: string) {
    const n = name.trim();
    if (!n) return;
    const dup = await this.prisma.templateFolder.findFirst({
      where: {
        userId,
        deletedAt: null,
        name: { equals: n, mode: 'insensitive' },
        ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
      },
    });
    if (dup) throw new ConflictException('A folder with this name already exists.');
  }

  private async assertTemplateNameInFolder(
    userId: string,
    folderId: string,
    name: string,
    excludeTemplateId?: string,
  ) {
    const n = name.trim();
    if (!n) return;
    const dup = await this.prisma.emailTemplate.findFirst({
      where: {
        userId,
        folderId,
        deletedAt: null,
        name: { equals: n, mode: 'insensitive' },
        ...(excludeTemplateId ? { id: { not: excludeTemplateId } } : {}),
      },
    });
    if (dup) throw new ConflictException('A template with this name already exists in this folder.');
  }

  async listFolders(userId: string, search?: string) {
    const where: Prisma.TemplateFolderWhereInput = {
      userId,
      deletedAt: null,
      ...(search?.trim()
        ? { name: { contains: search.trim(), mode: 'insensitive' } }
        : {}),
    };
    const folders = await this.prisma.templateFolder.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { templates: { where: { deletedAt: null } } } },
      },
    });
    const activeCampaigns = await this.prisma.campaign.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] },
      },
      select: { mainSequence: true, followUpSequence: true, mainFlowGraph: true },
    });
    const usedIds = new Set<string>();
    for (const c of activeCampaigns) {
      for (const id of templateIdsUsedInCampaign(c)) usedIds.add(id);
    }
    const idList = [...usedIds];
    const countsByFolder = new Map<string, number>();
    if (idList.length > 0) {
      for (const f of folders) {
        const n = await this.prisma.emailTemplate.count({
          where: {
            userId,
            folderId: f.id,
            deletedAt: null,
            id: { in: idList },
          },
        });
        countsByFolder.set(f.id, n);
      }
    }
    return folders.map((f) => ({
      ...f,
      activeTemplateCount: countsByFolder.get(f.id) ?? 0,
    }));
  }

  async getFolder(userId: string, id: string) {
    const f = await this.prisma.templateFolder.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!f) throw new NotFoundException('Folder not found.');
    return f;
  }

  async updateFolder(userId: string, id: string, name: string) {
    const n = name.trim();
    if (!n) throw new BadRequestException('Folder name is required.');
    const f = await this.prisma.templateFolder.findFirst({ where: { id, userId, deletedAt: null } });
    if (!f) throw new NotFoundException('Folder not found.');
    await this.assertFolderNameUnique(userId, n, id);
    return this.prisma.templateFolder.update({ where: { id }, data: { name: n } });
  }

  async createFolder(userId: string, name: string) {
    const n = name.trim();
    if (!n) throw new BadRequestException('Folder name is required.');
    await this.assertFolderNameUnique(userId, n);
    return this.prisma.templateFolder.create({ data: { userId, name: n } });
  }

  async deleteFolder(userId: string, id: string) {
    const f = await this.prisma.templateFolder.findFirst({ where: { id, userId, deletedAt: null } });
    if (!f) throw new NotFoundException('Folder not found.');
    await this.prisma.templateFolder.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.emailTemplate.updateMany({ where: { folderId: id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async listDeletedFolders(userId: string) {
    return this.prisma.templateFolder.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { templates: true } },
      },
    });
  }

  async restoreFolder(userId: string, id: string) {
    const f = await this.prisma.templateFolder.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });
    if (!f) throw new NotFoundException('Deleted folder not found.');
    await this.assertFolderNameUnique(userId, f.name, id);
    await this.prisma.templateFolder.update({ where: { id }, data: { deletedAt: null } });
    await this.prisma.emailTemplate.updateMany({
      where: { folderId: id, userId },
      data: { deletedAt: null },
    });
    return { ok: true };
  }

  async listTemplates(userId: string, folderId: string, search?: string) {
    const folder = await this.prisma.templateFolder.findFirst({
      where: { id: folderId, userId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found.');
    const rows = await this.prisma.emailTemplate.findMany({
      where: {
        folderId,
        userId,
        deletedAt: null,
        ...(search?.trim()
          ? { name: { contains: search.trim(), mode: 'insensitive' } }
          : {}),
      },
    });
    const useCounts = await this.templateUseCounts(userId);
    rows.sort((a, b) => {
      const ua = useCounts.get(a.id) ?? 0;
      const ub = useCounts.get(b.id) ?? 0;
      if (ua !== ub) return ub - ua;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return rows;
  }

  async createTemplate(
    userId: string,
    folderId: string,
    body: {
      name: string;
      subject?: string;
      body: string;
      includeUnsubscribeBlock?: boolean;
    },
  ) {
    const folder = await this.prisma.templateFolder.findFirst({
      where: { id: folderId, userId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found.');
    const n = body.name.trim();
    if (!n) throw new BadRequestException('Template name is required.');
    await this.assertTemplateNameInFolder(userId, folderId, n);
    return this.prisma.emailTemplate.create({
      data: {
        userId,
        folderId,
        name: n,
        subject: body.subject ?? '',
        body: body.body ?? '',
        includeUnsubscribeBlock: body.includeUnsubscribeBlock ?? false,
      },
    });
  }

  async updateTemplate(
    userId: string,
    id: string,
    body: Partial<{ name: string; subject: string; body: string; includeUnsubscribeBlock: boolean }>,
  ) {
    const t = await this.prisma.emailTemplate.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!t) throw new NotFoundException('Template not found.');
    if (body.name !== undefined) {
      const nm = body.name.trim();
      if (nm) await this.assertTemplateNameInFolder(userId, t.folderId, nm, id);
    }
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.includeUnsubscribeBlock !== undefined
          ? { includeUnsubscribeBlock: body.includeUnsubscribeBlock }
          : {}),
      },
    });
  }

  async deleteTemplate(userId: string, id: string) {
    const t = await this.prisma.emailTemplate.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!t) throw new NotFoundException('Template not found.');
    await this.prisma.emailTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async listAllTemplates(userId: string) {
    const rows = await this.prisma.emailTemplate.findMany({
      where: { userId, deletedAt: null },
      include: { folder: { select: { id: true, name: true } } },
    });
    const useCounts = await this.templateUseCounts(userId);
    rows.sort((a, b) => {
      const ua = useCounts.get(a.id) ?? 0;
      const ub = useCounts.get(b.id) ?? 0;
      if (ua !== ub) return ub - ua;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return rows;
  }

  async getTemplate(userId: string, id: string) {
    const t = await this.prisma.emailTemplate.findFirst({
      where: { id, userId, deletedAt: null },
      include: { folder: true },
    });
    if (!t) throw new NotFoundException('Template not found.');
    return t;
  }
}
