import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { AccessListDto, BulkDirectGrantDto, BulkGroupGrantDto, CreateGroupDto, DirectGrantDto, GroupGrantDto, GroupMemberDto, UpdateGroupDto } from './dto/access.dto';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async listGroups() { return this.prisma.accessGroup.findMany({ include: { _count: { select: { members: true, grants: true } } }, orderBy: { name: 'asc' } }); }
  async listMembers(groupId: string, query: AccessListDto) { const where = { groupId, ...(query.search ? { user: { OR: [{ username: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] } } : {}) }; const [items, total] = await this.prisma.$transaction([this.prisma.groupMember.findMany({ where, include: { user: { select: { id: true, username: true, email: true, status: true } } }, orderBy: { startsAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), this.prisma.groupMember.count({ where })]); return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }; }
  async createGroup(dto: CreateGroupDto, actor: AuthenticatedPrincipal, requestId: string) { try { const group = await this.prisma.accessGroup.create({ data: { name: dto.name.trim() } }); await this.audit.write({ actorId: actor.id, action: 'access.group_create', resource: 'access_group', resourceId: group.id, outcome: 'SUCCESS', requestId }); return group; } catch (e) { if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Group name already exists'); throw e; } }
  async updateGroup(id: string, dto: UpdateGroupDto, actor: AuthenticatedPrincipal, requestId: string) { try { const group = await this.prisma.accessGroup.update({ where: { id }, data: { name: dto.name.trim() } }); await this.audit.write({ actorId: actor.id, action: 'access.group_update', resource: 'access_group', resourceId: id, outcome: 'SUCCESS', requestId }); return group; } catch (e) { if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Group name already exists'); if ((e as { code?: string }).code === 'P2025') throw new NotFoundException('Group not found'); throw e; } }
  async deleteGroup(id: string, actor: AuthenticatedPrincipal, requestId: string) { try { await this.prisma.accessGroup.delete({ where: { id } }); } catch (e) { if ((e as { code?: string }).code === 'P2025') throw new NotFoundException('Group not found'); throw e; } await this.audit.write({ actorId: actor.id, action: 'access.group_delete', resource: 'access_group', resourceId: id, outcome: 'SUCCESS', requestId }); return { success: true }; }
  async addMember(groupId: string, dto: GroupMemberDto, actor: AuthenticatedPrincipal, requestId: string) { const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt); this.assertWindow(startsAt, endsAt); await this.ensureUser(dto.userId); try { const member = await this.prisma.groupMember.upsert({ where: { groupId_userId: { groupId, userId: dto.userId } }, create: { groupId, userId: dto.userId, startsAt, endsAt, comment: dto.comment, subscription: dto.subscription ?? false }, update: { startsAt, endsAt, comment: dto.comment, subscription: dto.subscription ?? false, revokedAt: null } }); await this.audit.write({ actorId: actor.id, action: 'access.member_add', resource: 'group_member', resourceId: member.id, outcome: 'SUCCESS', requestId }); return member; } catch (e) { if ((e as { code?: string }).code === 'P2003') throw new NotFoundException('Group not found'); throw e; } }
  async removeMember(groupId: string, userId: string, actor: AuthenticatedPrincipal, requestId: string) { const result = await this.prisma.groupMember.updateMany({ where: { groupId, userId, revokedAt: null }, data: { revokedAt: new Date() } }); if (!result.count) throw new NotFoundException('Group member not found'); await this.audit.write({ actorId: actor.id, action: 'access.member_remove', resource: 'group_member', outcome: 'SUCCESS', requestId, metadata: { groupId, userId } }); return { success: true }; }
  async grantDirect(dto: DirectGrantDto, actor: AuthenticatedPrincipal, requestId: string) { return this.createGrant(dto.episodeId, dto.userId, undefined, dto.startsAt, dto.endsAt, dto.note, actor, requestId); }
  async grantGroup(dto: GroupGrantDto, actor: AuthenticatedPrincipal, requestId: string) { return this.createGrant(dto.episodeId, undefined, dto.groupId, dto.startsAt, dto.endsAt, dto.note, actor, requestId); }
  async grantDirectBulk(dto: BulkDirectGrantDto, actor: AuthenticatedPrincipal, requestId: string) { return this.createBulkGrants(dto.episodeIds, dto.userId, undefined, dto.startsAt, dto.endsAt, dto.note, actor, requestId); }
  async grantGroupBulk(dto: BulkGroupGrantDto, actor: AuthenticatedPrincipal, requestId: string) { return this.createBulkGrants(dto.episodeIds, undefined, dto.groupId, dto.startsAt, dto.endsAt, dto.note, actor, requestId); }
  private async createGrant(episodeId: string, userId: string | undefined, groupId: string | undefined, starts: string, ends: string, note: string | undefined, actor: AuthenticatedPrincipal, requestId: string) { const startsAt = new Date(starts); const endsAt = new Date(ends); this.assertWindow(startsAt, endsAt); const episode = await this.prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true } }); if (!episode) throw new NotFoundException('Episode not found'); if (userId) await this.ensureUser(userId); if (groupId) { const group = await this.prisma.accessGroup.findUnique({ where: { id: groupId }, select: { id: true } }); if (!group) throw new NotFoundException('Group not found'); } const grant = await this.prisma.$transaction(async (tx) => { const item = await tx.episodeGrant.create({ data: { episodeId, userId, groupId, startsAt, endsAt } }); await tx.grantHistory.create({ data: { grantId: item.id, actorId: actor.id, action: 'created', newStatus: 'ACTIVE', newEndsAt: endsAt, note } }); return item; }); await this.audit.write({ actorId: actor.id, action: userId ? 'access.direct_grant' : 'access.group_grant', resource: 'episode_grant', resourceId: grant.id, outcome: 'SUCCESS', requestId, metadata: { episodeId, userId, groupId } }); return grant; }
  private async createBulkGrants(episodeIds: string[], userId: string | undefined, groupId: string | undefined, starts: string, ends: string, note: string | undefined, actor: AuthenticatedPrincipal, requestId: string) { const startsAt = new Date(starts); const endsAt = new Date(ends); this.assertWindow(startsAt, endsAt); if (userId) await this.ensureUser(userId); if (groupId && !(await this.prisma.accessGroup.findUnique({ where: { id: groupId }, select: { id: true } }))) throw new NotFoundException('Group not found'); const found = await this.prisma.episode.count({ where: { id: { in: episodeIds }, deletedAt: null } }); if (found !== episodeIds.length) throw new NotFoundException('One or more episodes not found'); const grants = await this.prisma.$transaction(async (tx) => { const created = []; for (const episodeId of episodeIds) { const grant = await tx.episodeGrant.create({ data: { episodeId, userId, groupId, startsAt, endsAt } }); await tx.grantHistory.create({ data: { grantId: grant.id, actorId: actor.id, action: 'created', newStatus: 'ACTIVE', newEndsAt: endsAt, note } }); created.push(grant); } return created; }); await this.audit.write({ actorId: actor.id, action: userId ? 'access.direct_grant_bulk' : 'access.group_grant_bulk', resource: 'episode_grant', outcome: 'SUCCESS', requestId, metadata: { count: grants.length, userId, groupId } }); return { items: grants, affected: grants.length }; }
  async revokeGrant(id: string, actor: AuthenticatedPrincipal, requestId: string) { const current = await this.prisma.episodeGrant.findUnique({ where: { id } }); if (!current) throw new NotFoundException('Grant not found'); const grant = await this.prisma.$transaction(async (tx) => { const item = await tx.episodeGrant.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() } }); await tx.grantHistory.create({ data: { grantId: id, actorId: actor.id, action: 'revoked', oldStatus: current.status, newStatus: 'REVOKED', oldEndsAt: current.endsAt, newEndsAt: current.endsAt } }); return item; }); await this.audit.write({ actorId: actor.id, action: 'access.grant_revoke', resource: 'episode_grant', resourceId: id, outcome: 'SUCCESS', requestId }); return grant; }
  async listGrants(query: AccessListDto) { const where = { ...(query.episodeId ? { episodeId: query.episodeId } : {}), ...(query.userId ? { userId: query.userId } : {}), ...(query.groupId ? { groupId: query.groupId } : {}) }; const [items, total] = await this.prisma.$transaction([this.prisma.episodeGrant.findMany({ where, include: { episode: { select: { id: true, episodeNumber: true, title: true } }, user: { select: { id: true, username: true, email: true } }, group: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), this.prisma.episodeGrant.count({ where })]); return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }; }
  async history(grantId: string) { return this.prisma.grantHistory.findMany({ where: { grantId }, orderBy: { createdAt: 'desc' } }); }
  async validate(episodeId: string, principal: AuthenticatedPrincipal) { const now = new Date(); const direct = await this.prisma.episodeGrant.findFirst({ where: { episodeId, userId: principal.id, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now }, revokedAt: null } }); const group = await this.prisma.episodeGrant.findFirst({ where: { episodeId, groupId: { not: null }, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now }, revokedAt: null, group: { members: { some: { userId: principal.id, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } } } } } }); return { allowed: Boolean(direct || group), grantId: direct?.id ?? group?.id ?? null, source: direct ? 'direct' : group ? 'group' : null }; }
  async listMyUnlockedEpisodes(principal: AuthenticatedPrincipal, query: AccessListDto) {
    const now = new Date();
    const where = {
      status: 'ACTIVE' as const,
      startsAt: { lte: now },
      endsAt: { gt: now },
      revokedAt: null,
      OR: [
        { userId: principal.id },
        { groupId: { not: null }, group: { members: { some: { userId: principal.id, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } } } } },
      ],
      ...(query.episodeId ? { episodeId: query.episodeId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.episodeGrant.findMany({
        where,
        distinct: ['episodeId'],
        include: {
          episode: {
            select: {
              id: true,
              episodeNumber: true,
              title: true,
              description: true,
              thumbnailKey: true,
              isPremium: true,
              season: { select: { id: true, seasonNumber: true, title: true, drama: { select: { id: true, name: true, slug: true, thumbnailKey: true } } } },
            },
          },
          group: { select: { id: true, name: true } },
        },
        orderBy: { endsAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.episodeGrant.count({ where }),
    ]);
    return {
      items: items.map((grant) => ({
        grantId: grant.id,
        source: grant.userId === principal.id ? 'direct' : 'group',
        group: grant.group,
        startsAt: grant.startsAt,
        endsAt: grant.endsAt,
        episode: grant.episode,
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
  private async ensureUser(id: string) { const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } }); if (!user) throw new NotFoundException('User not found'); }
  private assertWindow(startsAt: Date, endsAt: Date) { if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) throw new BadRequestException('startsAt must be before endsAt'); }
}
