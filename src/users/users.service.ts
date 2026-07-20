import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { CreateUserDto, ListUsersDto, UpdateProfileDto, UpdateStatusDto } from './dto/user.dto';
import * as argon2 from 'argon2';
import { RoleCode } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async create(dto: CreateUserDto, actor: AuthenticatedPrincipal, requestId: string) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { username: dto.username.trim(), email, passwordHash } });
        const role = dto.role ?? RoleCode.USER;
        const roleDefinition = await tx.roleDefinition.findUniqueOrThrow({ where: { code: role } });
        await tx.userRole.create({ data: { userId: created.id, roleId: roleDefinition.id } });
        return created;
      });
      await this.audit.write({ actorId: actor.id, action: 'users.create', resource: 'user', resourceId: user.id, outcome: 'SUCCESS', requestId });
      return this.safe(user);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email or username is already in use');
      throw error;
    }
  }

  async list(query: ListUsersDto) {
    const where = { deletedAt: null, ...(query.status ? { status: query.status } : {}), ...(query.search ? { OR: [{ email: { contains: query.search.trim().toLowerCase(), mode: 'insensitive' as const } }, { username: { contains: query.search.trim(), mode: 'insensitive' as const } }] } : {}), ...(query.role ? { roles: { some: { role: { code: query.role } } } } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: { id: true, username: true, email: true, status: true, profileImageKey: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { code: true, name: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.user.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, username: true, email: true, status: true, profileImageKey: true, createdAt: true, updatedAt: true, lastLoginAt: true, roles: { select: { role: { select: { code: true, name: true } } } } } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto, actor: AuthenticatedPrincipal, requestId: string) {
    if (actor.id !== id && !actor.roles.includes(RoleCode.SUPER_ADMIN) && !actor.permissions.includes('users.write')) throw new NotFoundException('User not found');
    try {
      const user = await this.prisma.user.update({ where: { id }, data: { ...(dto.username ? { username: dto.username.trim() } : {}), ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}), ...(dto.profileImageKey !== undefined ? { profileImageKey: dto.profileImageKey } : {}) }, select: { id: true, username: true, email: true, status: true, profileImageKey: true, updatedAt: true } });
      await this.audit.write({ actorId: actor.id, action: 'users.profile_update', resource: 'user', resourceId: id, outcome: 'SUCCESS', requestId });
      return user;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email or username is already in use');
      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: AuthenticatedPrincipal, requestId: string) {
    if (actor.id === id && dto.status !== 'ACTIVE') throw new ConflictException('You cannot disable your own account');
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({ where: { id }, data: { status: dto.status } });
      if (dto.status !== 'ACTIVE') await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return result;
    });
    await this.audit.write({ actorId: actor.id, action: `users.${dto.status.toLowerCase()}`, resource: 'user', resourceId: id, outcome: 'SUCCESS', requestId });
    return this.safe(updated);
  }

  async remove(id: string, actor: AuthenticatedPrincipal, requestId: string) {
    if (actor.id === id) throw new ConflictException('You cannot delete your own account');
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), status: 'DISABLED' } });
      await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    if (!result.count) throw new NotFoundException('User not found');
    await this.audit.write({ actorId: actor.id, action: 'users.delete', resource: 'user', resourceId: id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  private safe(user: { id: string; username: string; email: string; status: string; profileImageKey: string | null; createdAt: Date; lastLoginAt?: Date | null }) { return user; }
}
