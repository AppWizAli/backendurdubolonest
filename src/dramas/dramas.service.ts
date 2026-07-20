import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { BulkIdsDto, DramaListQueryDto } from '../content/dto/content-query.dto';
import { CreateDramaDto, UpdateDramaDto } from './dto/drama.dto';

@Injectable()
export class DramasService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: DramaListQueryDto, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const where: Prisma.DramaWhereInput = { deletedAt: admin && query.includeDeleted ? undefined : null };
    if (!admin || query.published !== undefined) where.isPublished = admin ? query.published : true;
    if (query.search) where.OR = [{ name: { contains: query.search.trim(), mode: 'insensitive' } }, { slug: { contains: query.search.trim().toLowerCase(), mode: 'insensitive' } }];
    const sort = this.sort(query.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.drama.findMany({ where, orderBy: { [sort]: query.order }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, name: true, slug: true, description: true, thumbnailKey: true, isPublished: true, createdAt: true, updatedAt: true, deletedAt: true, _count: { select: { seasons: true } } } }),
      this.prisma.drama.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async details(id: string, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const drama = await this.prisma.drama.findFirst({ where: { id, ...(admin ? {} : { deletedAt: null, isPublished: true }) }, include: { seasons: { where: admin ? {} : { deletedAt: null }, orderBy: { seasonNumber: 'asc' }, select: { id: true, seasonNumber: true, title: true, createdAt: true, updatedAt: true, deletedAt: true, _count: { select: { episodes: true } } } } } });
    if (!drama) throw new NotFoundException('Drama not found');
    return drama;
  }

  async create(dto: CreateDramaDto, actor: AuthenticatedPrincipal, requestId: string) {
    try {
      const drama = await this.prisma.drama.create({ data: { name: dto.name.trim(), slug: dto.slug.toLowerCase(), ...(dto.dramaNumber !== undefined ? { dramaNumber: dto.dramaNumber } : {}), ...(dto.totalSeasons !== undefined ? { totalSeasons: dto.totalSeasons } : {}), description: dto.description, thumbnailKey: dto.thumbnailKey, isPublished: dto.isPublished ?? false } });
      await this.audit.write({ actorId: actor.id, action: 'content.drama_create', resource: 'drama', resourceId: drama.id, outcome: 'SUCCESS', requestId });
      return drama;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Drama slug already exists'); throw error; }
  }

  async update(id: string, dto: UpdateDramaDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureActive(id);
    try {
      const drama = await this.prisma.drama.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.slug !== undefined ? { slug: dto.slug.toLowerCase() } : {}), ...(dto.dramaNumber !== undefined ? { dramaNumber: dto.dramaNumber } : {}), ...(dto.totalSeasons !== undefined ? { totalSeasons: dto.totalSeasons } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}), ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}), ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}) } });
      await this.audit.write({ actorId: actor.id, action: 'content.drama_update', resource: 'drama', resourceId: id, outcome: 'SUCCESS', requestId });
      return drama;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Drama slug already exists'); throw error; }
  }

  async remove(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const drama = await tx.drama.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now, isPublished: false } });
      if (!drama.count) return 0;
      const seasons = await tx.season.findMany({ where: { dramaId: id }, select: { id: true } });
      const seasonIds = seasons.map((item) => item.id);
      const episodes = await tx.episode.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true } });
      const episodeIds = episodes.map((item) => item.id);
      if (seasonIds.length) await tx.season.updateMany({ where: { id: { in: seasonIds }, deletedAt: null }, data: { deletedAt: now } });
      if (episodeIds.length) { await tx.episode.updateMany({ where: { id: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } }); await tx.mediaAsset.updateMany({ where: { episodeId: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); }
      return 1;
    });
    if (!result) throw new NotFoundException('Drama not found');
    await this.audit.write({ actorId: actor.id, action: 'content.drama_delete', resource: 'drama', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async restore(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    const result = await this.prisma.drama.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
    if (!result.count) throw new NotFoundException('Deleted drama not found');
    await this.audit.write({ actorId: actor.id, action: 'content.drama_restore', resource: 'drama', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async publish(id: string, isPublished: boolean, actor: AuthenticatedPrincipal, requestId: string) {
    const result = await this.prisma.drama.updateMany({ where: { id, deletedAt: null }, data: { isPublished } });
    if (!result.count) throw new NotFoundException('Drama not found');
    await this.audit.write({ actorId: actor.id, action: isPublished ? 'content.drama_publish' : 'content.drama_unpublish', resource: 'drama', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true, isPublished };
  }

  async bulk(ids: BulkIdsDto, action: 'publish' | 'unpublish' | 'delete' | 'restore', actor: AuthenticatedPrincipal, requestId: string) {
    const now = new Date();
    let count = 0;
    if (action === 'publish' || action === 'unpublish') count = (await this.prisma.drama.updateMany({ where: { id: { in: ids.ids }, deletedAt: null }, data: { isPublished: action === 'publish' } })).count;
    if (action === 'restore') count = (await this.prisma.drama.updateMany({ where: { id: { in: ids.ids }, deletedAt: { not: null } }, data: { deletedAt: null } })).count;
    if (action === 'delete') {
      count = (await this.prisma.drama.updateMany({ where: { id: { in: ids.ids }, deletedAt: null }, data: { deletedAt: now, isPublished: false } })).count;
      await this.prisma.season.updateMany({ where: { dramaId: { in: ids.ids }, deletedAt: null }, data: { deletedAt: now } });
      const seasons = await this.prisma.season.findMany({ where: { dramaId: { in: ids.ids } }, select: { id: true } });
      const seasonIds = seasons.map((item) => item.id);
      if (seasonIds.length) { await this.prisma.episode.updateMany({ where: { seasonId: { in: seasonIds }, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } }); const episodes = await this.prisma.episode.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true } }); await this.prisma.mediaAsset.updateMany({ where: { episodeId: { in: episodes.map((item) => item.id) }, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); }
    }
    await this.audit.write({ actorId: actor.id, action: `content.drama_bulk_${action}`, resource: 'drama', outcome: 'SUCCESS', requestId, metadata: { requested: ids.ids.length, affected: count } });
    return { success: true, affected: count };
  }

  private async ensureActive(id: string) { const drama = await this.prisma.drama.findFirst({ where: { id, deletedAt: null }, select: { id: true } }); if (!drama) throw new NotFoundException('Drama not found'); }
  private canReadAll(actor?: AuthenticatedPrincipal) { return Boolean(actor && (actor.roles.includes(RoleCode.SUPER_ADMIN) || actor.permissions.includes('content.read'))); }
  private sort(value: string | undefined): 'name' | 'slug' | 'createdAt' | 'updatedAt' { return value === 'name' || value === 'slug' || value === 'updatedAt' ? value : 'createdAt'; }
}
