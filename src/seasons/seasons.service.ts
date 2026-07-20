import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { BulkIdsDto, SeasonListQueryDto } from '../content/dto/content-query.dto';
import { CreateSeasonDto, UpdateSeasonDto } from './dto/season.dto';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: SeasonListQueryDto, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const where: Prisma.SeasonWhereInput = { deletedAt: admin && query.includeDeleted ? undefined : null, drama: admin ? (query.dramaId ? { id: query.dramaId, ...(query.includeDeleted ? {} : { deletedAt: null }) } : (query.includeDeleted ? undefined : { deletedAt: null })) : { id: query.dramaId, deletedAt: null, isPublished: true } };
    if (query.search) where.title = { contains: query.search.trim(), mode: 'insensitive' };
    const sort = this.sort(query.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.season.findMany({ where, orderBy: { [sort]: query.order }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, dramaId: true, seasonNumber: true, title: true, createdAt: true, updatedAt: true, deletedAt: true, drama: { select: { id: true, name: true, slug: true, isPublished: true } }, _count: { select: { episodes: true } } } }),
      this.prisma.season.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async details(id: string, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const season = await this.prisma.season.findFirst({ where: { id, ...(admin ? {} : { deletedAt: null, drama: { deletedAt: null, isPublished: true } }) }, include: { drama: { select: { id: true, name: true, slug: true, isPublished: true } }, episodes: { where: admin ? {} : { deletedAt: null, isPublished: true, visibility: 'PUBLIC' }, orderBy: { episodeNumber: 'asc' }, select: { id: true, episodeNumber: true, title: true, isPublished: true, visibility: true, isPremium: true, thumbnailKey: true, deletedAt: true } } } });
    if (!season) throw new NotFoundException('Season not found');
    return season;
  }

  async create(dto: CreateSeasonDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureDrama(dto.dramaId);
    try {
      const season = await this.prisma.season.create({ data: { dramaId: dto.dramaId, seasonNumber: dto.seasonNumber, title: dto.title?.trim(), ...(dto.totalEpisodes !== undefined ? { totalEpisodes: dto.totalEpisodes } : {}), ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}) } });
      await this.audit.write({ actorId: actor.id, action: 'content.season_create', resource: 'season', resourceId: season.id, outcome: 'SUCCESS', requestId });
      return season;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Season number already exists for this drama'); throw error; }
  }

  async update(id: string, dto: UpdateSeasonDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureActive(id);
    if (dto.dramaId !== undefined) await this.ensureDrama(dto.dramaId);
    try {
      const season = await this.prisma.season.update({ where: { id }, data: { ...(dto.dramaId !== undefined ? { dramaId: dto.dramaId } : {}), ...(dto.seasonNumber !== undefined ? { seasonNumber: dto.seasonNumber } : {}), ...(dto.title !== undefined ? { title: dto.title.trim() } : {}), ...(dto.totalEpisodes !== undefined ? { totalEpisodes: dto.totalEpisodes } : {}), ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}) } });
      await this.audit.write({ actorId: actor.id, action: 'content.season_update', resource: 'season', resourceId: id, outcome: 'SUCCESS', requestId });
      return season;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Season number already exists for this drama'); throw error; }
  }

  async remove(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const season = await tx.season.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now } });
      if (!season.count) return 0;
      const episodes = await tx.episode.findMany({ where: { seasonId: id }, select: { id: true } });
      const episodeIds = episodes.map((item) => item.id);
      if (episodeIds.length) { await tx.episode.updateMany({ where: { id: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } }); await tx.mediaAsset.updateMany({ where: { episodeId: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); }
      return 1;
    });
    if (!result) throw new NotFoundException('Season not found');
    await this.audit.write({ actorId: actor.id, action: 'content.season_delete', resource: 'season', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async restore(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    const result = await this.prisma.season.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
    if (!result.count) throw new NotFoundException('Deleted season not found');
    await this.audit.write({ actorId: actor.id, action: 'content.season_restore', resource: 'season', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async bulk(ids: BulkIdsDto, action: 'delete' | 'restore', actor: AuthenticatedPrincipal, requestId: string) {
    let count = 0;
    if (action === 'restore') count = (await this.prisma.season.updateMany({ where: { id: { in: ids.ids }, deletedAt: { not: null } }, data: { deletedAt: null } })).count;
    if (action === 'delete') { const now = new Date(); count = (await this.prisma.season.updateMany({ where: { id: { in: ids.ids }, deletedAt: null }, data: { deletedAt: now } })).count; const episodes = await this.prisma.episode.findMany({ where: { seasonId: { in: ids.ids } }, select: { id: true } }); const episodeIds = episodes.map((item) => item.id); if (episodeIds.length) { await this.prisma.episode.updateMany({ where: { id: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } }); await this.prisma.mediaAsset.updateMany({ where: { episodeId: { in: episodeIds }, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); } }
    await this.audit.write({ actorId: actor.id, action: `content.season_bulk_${action}`, resource: 'season', outcome: 'SUCCESS', requestId, metadata: { requested: ids.ids.length, affected: count } });
    return { success: true, affected: count };
  }

  private async ensureDrama(id: string) { const drama = await this.prisma.drama.findFirst({ where: { id, deletedAt: null }, select: { id: true } }); if (!drama) throw new NotFoundException('Drama not found'); }
  private async ensureActive(id: string) { const season = await this.prisma.season.findFirst({ where: { id, deletedAt: null, drama: { deletedAt: null } }, select: { id: true } }); if (!season) throw new NotFoundException('Season not found'); }
  private canReadAll(actor?: AuthenticatedPrincipal) { return Boolean(actor && (actor.roles.includes(RoleCode.SUPER_ADMIN) || actor.permissions.includes('content.read'))); }
  private sort(value: string | undefined): 'seasonNumber' | 'title' | 'createdAt' | 'updatedAt' { return value === 'seasonNumber' || value === 'title' || value === 'updatedAt' ? value : 'createdAt'; }
}
