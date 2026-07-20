import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { BulkIdsDto, EpisodeListQueryDto } from '../content/dto/content-query.dto';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';

const mediaSelect = { id: true, episodeId: true, mediaType: true, kind: true, provider: true, checksum: true, status: true, metadata: true, version: true, durationSeconds: true, sizeBytes: true, createdAt: true, updatedAt: true, rotatedAt: true, deletedAt: true } as const;

@Injectable()
export class EpisodesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: EpisodeListQueryDto, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const season: Prisma.SeasonWhereInput = {};
    if (query.seasonId) season.id = query.seasonId;
    if (query.dramaId) season.dramaId = query.dramaId;
    if (!admin || !query.includeDeleted) season.deletedAt = null;
    if (!admin) season.drama = { deletedAt: null, isPublished: true };
    else if (!query.includeDeleted) season.deletedAt = null;
    const where: Prisma.EpisodeWhereInput = { deletedAt: admin && query.includeDeleted ? undefined : null, season: Object.keys(season).length ? season : undefined };
    if (!admin || query.published !== undefined) where.isPublished = admin ? query.published : true;
    if (!admin || query.status !== undefined) where.status = admin ? query.status : 'PUBLISHED';
    if (!admin || query.visibility !== undefined) where.visibility = admin ? query.visibility : 'PUBLIC';
    if (query.premium !== undefined) where.isPremium = query.premium;
    if (query.search) where.title = { contains: query.search.trim(), mode: 'insensitive' };
    const sort = this.sort(query.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.episode.findMany({ where, orderBy: { [sort]: query.order }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, seasonId: true, episodeNumber: true, title: true, description: true, thumbnailKey: true, isPublished: true, status: true, visibility: true, isPremium: true, downloadAccess: true, createdAt: true, updatedAt: true, deletedAt: true, season: { select: { id: true, seasonNumber: true, title: true, drama: { select: { id: true, name: true, slug: true, isPublished: true } } } }, mediaAsset: { select: mediaSelect } } }),
      this.prisma.episode.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async details(id: string, actor?: AuthenticatedPrincipal) {
    const admin = this.canReadAll(actor);
    const episode = await this.prisma.episode.findFirst({ where: { id, ...(admin ? {} : { deletedAt: null, isPublished: true, status: 'PUBLISHED', visibility: 'PUBLIC', season: { deletedAt: null, drama: { deletedAt: null, isPublished: true } } }) }, select: { id: true, seasonId: true, episodeNumber: true, title: true, description: true, thumbnailKey: true, isPublished: true, status: true, visibility: true, isPremium: true, downloadAccess: true, createdAt: true, updatedAt: true, deletedAt: true, season: { select: { id: true, seasonNumber: true, title: true, drama: { select: { id: true, name: true, slug: true, isPublished: true } } } }, mediaAsset: { select: mediaSelect } } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (!admin && episode.mediaAsset?.deletedAt) return { ...episode, mediaAsset: null };
    return episode;
  }

  async create(dto: CreateEpisodeDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureSeason(dto.seasonId);
    try {
      const status = dto.status ?? (dto.isPublished ? 'PUBLISHED' : 'DRAFT');
      const episode = await this.prisma.episode.create({ data: { seasonId: dto.seasonId, episodeNumber: dto.episodeNumber, title: dto.title?.trim(), description: dto.description, thumbnailKey: dto.thumbnailKey, isPublished: status === 'PUBLISHED', status, visibility: dto.visibility ?? 'PRIVATE', isPremium: dto.isPremium ?? true, ...(dto.downloadAccess !== undefined ? { downloadAccess: dto.downloadAccess } : {}) } });
      await this.audit.write({ actorId: actor.id, action: 'content.episode_create', resource: 'episode', resourceId: episode.id, outcome: 'SUCCESS', requestId });
      return episode;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Episode number already exists for this season'); throw error; }
  }

  async update(id: string, dto: UpdateEpisodeDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureActive(id);
    if (dto.seasonId !== undefined) await this.ensureSeason(dto.seasonId);
    try {
      const status = dto.status ?? (dto.isPublished === undefined ? undefined : dto.isPublished ? 'PUBLISHED' : 'DRAFT');
      const episode = await this.prisma.episode.update({ where: { id }, data: { ...(dto.seasonId !== undefined ? { seasonId: dto.seasonId } : {}), ...(dto.episodeNumber !== undefined ? { episodeNumber: dto.episodeNumber } : {}), ...(dto.title !== undefined ? { title: dto.title.trim() } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}), ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}), ...(dto.isPublished !== undefined || status !== undefined ? { isPublished: status === 'PUBLISHED', status } : {}), ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}), ...(dto.isPremium !== undefined ? { isPremium: dto.isPremium } : {}), ...(dto.downloadAccess !== undefined ? { downloadAccess: dto.downloadAccess } : {}) } });
      await this.audit.write({ actorId: actor.id, action: 'content.episode_update', resource: 'episode', resourceId: id, outcome: 'SUCCESS', requestId });
      return episode;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Episode number already exists for this season'); throw error; }
  }

  async remove(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => { const episode = await tx.episode.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } }); if (episode.count) await tx.mediaAsset.updateMany({ where: { episodeId: id, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); return episode.count; });
    if (!result) throw new NotFoundException('Episode not found');
    await this.audit.write({ actorId: actor.id, action: 'content.episode_delete', resource: 'episode', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async restore(id: string, actor: AuthenticatedPrincipal, requestId: string) { const result = await this.prisma.episode.updateMany({ where: { id, deletedAt: { not: null }, season: { deletedAt: null, drama: { deletedAt: null } } }, data: { deletedAt: null, status: 'DRAFT' } }); if (!result.count) throw new NotFoundException('Deleted episode or parent is unavailable'); await this.audit.write({ actorId: actor.id, action: 'content.episode_restore', resource: 'episode', resourceId: id, outcome: 'SUCCESS', requestId }); return { success: true }; }
  async publish(id: string, isPublished: boolean, actor: AuthenticatedPrincipal, requestId: string) { const result = await this.prisma.episode.updateMany({ where: { id, deletedAt: null, season: { deletedAt: null, drama: { deletedAt: null } } }, data: { isPublished, status: isPublished ? 'PUBLISHED' : 'DRAFT' } }); if (!result.count) throw new NotFoundException('Episode not found'); await this.audit.write({ actorId: actor.id, action: isPublished ? 'content.episode_publish' : 'content.episode_unpublish', resource: 'episode', resourceId: id, outcome: 'SUCCESS', requestId }); return { success: true, isPublished }; }

  async bulk(ids: BulkIdsDto, action: 'publish' | 'unpublish' | 'delete' | 'restore', actor: AuthenticatedPrincipal, requestId: string) {
    const parent = { season: { deletedAt: null, drama: { deletedAt: null } } };
    let count = 0;
    if (action === 'publish' || action === 'unpublish') count = (await this.prisma.episode.updateMany({ where: { id: { in: ids.ids }, deletedAt: null, ...parent }, data: { isPublished: action === 'publish', status: action === 'publish' ? 'PUBLISHED' : 'DRAFT' } })).count;
    if (action === 'restore') count = (await this.prisma.episode.updateMany({ where: { id: { in: ids.ids }, deletedAt: { not: null }, ...parent }, data: { deletedAt: null, status: 'DRAFT' } })).count;
    if (action === 'delete') { const now = new Date(); count = (await this.prisma.episode.updateMany({ where: { id: { in: ids.ids }, deletedAt: null }, data: { deletedAt: now, isPublished: false, status: 'ARCHIVED' } })).count; await this.prisma.mediaAsset.updateMany({ where: { episodeId: { in: ids.ids }, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } }); }
    await this.audit.write({ actorId: actor.id, action: `content.episode_bulk_${action}`, resource: 'episode', outcome: 'SUCCESS', requestId, metadata: { requested: ids.ids.length, affected: count } });
    return { success: true, affected: count };
  }

  private async ensureSeason(id: string) { const season = await this.prisma.season.findFirst({ where: { id, deletedAt: null, drama: { deletedAt: null } }, select: { id: true } }); if (!season) throw new NotFoundException('Season not found'); }
  private async ensureActive(id: string) { const episode = await this.prisma.episode.findFirst({ where: { id, deletedAt: null, season: { deletedAt: null, drama: { deletedAt: null } } }, select: { id: true } }); if (!episode) throw new NotFoundException('Episode not found'); }
  private canReadAll(actor?: AuthenticatedPrincipal) { return Boolean(actor && (actor.roles.includes(RoleCode.SUPER_ADMIN) || actor.permissions.includes('content.read'))); }
  private sort(value: string | undefined): 'episodeNumber' | 'title' | 'createdAt' | 'updatedAt' { return value === 'episodeNumber' || value === 'title' || value === 'updatedAt' ? value : 'createdAt'; }
}
