import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { MediaAssetListQueryDto } from '../content/dto/content-query.dto';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from './dto/media-asset.dto';
import { MediaLocatorCipherService } from '../media-gateway/media-locator-cipher.service';
import { StorageProviderAdapter } from '../media-gateway/storage-provider.adapter';

const safeSelect = { id: true, episodeId: true, kind: true, mediaType: true, provider: true, checksum: true, status: true, metadata: true, version: true, durationSeconds: true, sizeBytes: true, createdAt: true, updatedAt: true, rotatedAt: true, deletedAt: true } as const;

@Injectable()
export class MediaAssetsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly cipher: MediaLocatorCipherService, private readonly provider: StorageProviderAdapter) {}

  async list(query: MediaAssetListQueryDto) {
    const where: Prisma.MediaAssetWhereInput = { deletedAt: query.includeDeleted ? undefined : null, ...(query.episodeId ? { episodeId: query.episodeId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.mediaType ? { mediaType: query.mediaType } : {}) };
    if (query.search) where.provider = { contains: query.search.trim(), mode: 'insensitive' };
    const sort = query.sort === 'version' ? 'version' : query.sort === 'updatedAt' ? 'updatedAt' : 'createdAt';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({ where, orderBy: { [sort]: query.order }, skip: (query.page - 1) * query.limit, take: query.limit, select: safeSelect }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { items: rows.map((row) => this.safe(row)), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async details(id: string) { const row = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null }, select: safeSelect }); if (!row) throw new NotFoundException('Media asset not found'); return this.safe(row); }

  async validate(id: string) {
    const row = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null }, select: { id: true, provider: true, status: true, encryptedLocator: true, mediaType: true, version: true } });
    if (!row) throw new NotFoundException('Media asset not found');
    try {
      const locator = this.cipher.decrypt(row.encryptedLocator);
      const url = this.provider.validateUrl(locator);
      return { valid: true, assetId: row.id, provider: row.provider, mediaType: row.mediaType, status: row.status, version: row.version, host: url.hostname, path: url.pathname };
    } catch (error) {
      return { valid: false, assetId: row.id, provider: row.provider, mediaType: row.mediaType, status: 'ERROR', reason: error instanceof Error ? error.message : 'Media locator validation failed' };
    }
  }

  async create(dto: CreateMediaAssetDto, actor: AuthenticatedPrincipal, requestId: string) {
    await this.ensureEpisode(dto.episodeId);
    const existing = await this.prisma.mediaAsset.findUnique({ where: { episodeId: dto.episodeId }, select: { id: true } });
    if (existing) throw new ConflictException('Episode already has a media asset; update or restore it instead');
    try {
      const row = await this.prisma.mediaAsset.create({ data: { episodeId: dto.episodeId, kind: dto.mediaType, mediaType: dto.mediaType, provider: dto.provider.trim(), encryptedLocator: dto.encryptedLocator, checksum: dto.checksum?.toLowerCase(), status: dto.status ?? 'PROCESSING', metadata: dto.metadata as Prisma.InputJsonValue | undefined, version: dto.version ?? 1, durationSeconds: dto.durationSeconds, sizeBytes: dto.sizeBytes === undefined ? undefined : BigInt(dto.sizeBytes) }, select: safeSelect });
      await this.audit.write({ actorId: actor.id, action: 'content.media_create', resource: 'media_asset', resourceId: row.id, outcome: 'SUCCESS', requestId });
      return this.safe(row);
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Episode already has a media asset'); throw error; }
  }

  async update(id: string, dto: UpdateMediaAssetDto, actor: AuthenticatedPrincipal, requestId: string) {
    const current = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null }, select: { id: true, version: true, encryptedLocator: true } });
    if (!current) throw new NotFoundException('Media asset not found');
    const locatorChanged = dto.encryptedLocator !== undefined && dto.encryptedLocator !== current.encryptedLocator;
    const row = await this.prisma.mediaAsset.update({ where: { id }, data: { ...(dto.mediaType !== undefined ? { mediaType: dto.mediaType, kind: dto.mediaType } : {}), ...(dto.provider !== undefined ? { provider: dto.provider.trim() } : {}), ...(dto.encryptedLocator !== undefined ? { encryptedLocator: dto.encryptedLocator } : {}), ...(dto.checksum !== undefined ? { checksum: dto.checksum.toLowerCase() } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}), ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}), ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}), ...(dto.sizeBytes !== undefined ? { sizeBytes: BigInt(dto.sizeBytes) } : {}), ...(dto.version !== undefined || locatorChanged ? { version: dto.version ?? current.version + 1 } : {}), ...(locatorChanged ? { rotatedAt: new Date() } : {}) }, select: safeSelect });
    await this.audit.write({ actorId: actor.id, action: 'content.media_update', resource: 'media_asset', resourceId: id, outcome: 'SUCCESS', requestId, metadata: { locatorRotated: locatorChanged } });
    return this.safe(row);
  }

  async remove(id: string, actor: AuthenticatedPrincipal, requestId: string) { const result = await this.prisma.mediaAsset.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), status: 'INACTIVE' } }); if (!result.count) throw new NotFoundException('Media asset not found'); await this.audit.write({ actorId: actor.id, action: 'content.media_delete', resource: 'media_asset', resourceId: id, outcome: 'SUCCESS', requestId }); return { success: true }; }
  async restore(id: string, actor: AuthenticatedPrincipal, requestId: string) { const row = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: { not: null }, episode: { deletedAt: null, season: { deletedAt: null, drama: { deletedAt: null } } } }, select: { id: true } }); if (!row) throw new NotFoundException('Deleted media asset or parent is unavailable'); await this.prisma.mediaAsset.update({ where: { id }, data: { deletedAt: null, status: 'PROCESSING' } }); await this.audit.write({ actorId: actor.id, action: 'content.media_restore', resource: 'media_asset', resourceId: id, outcome: 'SUCCESS', requestId }); return { success: true }; }

  private async ensureEpisode(id: string) { const episode = await this.prisma.episode.findFirst({ where: { id, deletedAt: null, season: { deletedAt: null, drama: { deletedAt: null } } }, select: { id: true } }); if (!episode) throw new NotFoundException('Episode not found'); }
  private safe<T extends { sizeBytes: bigint | null }>(row: T) { return { ...row, sizeBytes: row.sizeBytes === null ? null : row.sizeBytes.toString() }; }
}
