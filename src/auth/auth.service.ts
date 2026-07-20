import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { LoginDto, RegisterDto } from './dto/login.dto';
import { ConflictException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { AuditService } from '../common/audit/audit.service';

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress: string, userAgent: string, requestId: string = randomUUID()): Promise<unknown> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { username: dto.username.trim(), email, passwordHash, status: UserStatus.ACTIVE } });
        const role = await tx.roleDefinition.findUniqueOrThrow({ where: { code: 'USER' } });
        await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
        return created;
      });
      await this.prisma.loginHistory.create({ data: { userId: user.id, email, succeeded: true, reason: 'registration', ipAddress, userAgent: userAgent.slice(0, 512) } });
      await this.audit.write({ actorId: user.id, action: 'auth.register', resource: 'user', resourceId: user.id, outcome: 'SUCCESS', requestId, ipAddress, userAgent });
      return this.issueTokenPair(user.id, dto.deviceId, ipAddress, userAgent);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email or username is already in use');
      throw error;
    }
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string, requestId: string = randomUUID()): Promise<unknown> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, passwordHash: true, status: true, lockedUntil: true, failedLoginCount: true },
    });
    const hash = user?.passwordHash ?? this.config.getOrThrow<string>('ARGON2_DUMMY_HASH');
    const passwordMatches = await argon2.verify(hash, dto.password).catch(() => false);
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const valid = Boolean(user && passwordMatches && user.status === UserStatus.ACTIVE && !locked);

    if (!valid) {
      if (user && !locked) {
        const failedCount = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: failedCount, lockedUntil: failedCount >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
        });
      }
      await this.prisma.loginHistory.create({ data: { userId: user?.id, email, succeeded: false, reason: locked ? 'account_locked' : 'invalid_credentials', ipAddress, userAgent: userAgent.slice(0, 512) } });
      await this.audit.write({ actorId: user?.id, action: 'auth.login', resource: 'user', resourceId: user?.id, outcome: 'DENIED', requestId, ipAddress, userAgent, metadata: { reason: locked ? 'account_locked' : 'invalid_credentials' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.prisma.loginHistory.create({ data: { userId: user.id, email, succeeded: true, reason: 'login', ipAddress, userAgent: userAgent.slice(0, 512) } });
    await this.audit.write({ actorId: user.id, action: 'auth.login', resource: 'user', resourceId: user.id, outcome: 'SUCCESS', requestId, ipAddress, userAgent });
    return this.issueTokenPair(user.id, dto.deviceId, ipAddress, userAgent);
  }

  async refresh(refreshToken: string, ipAddress: string, userAgent: string, requestId: string = randomUUID()): Promise<unknown> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: { tokenHash, user: { deletedAt: null } },
      select: { id: true, userId: true, deviceId: true, revokedAt: true, expiresAt: true, user: { select: { status: true } } },
    });
    if (!session || session.user.status !== UserStatus.ACTIVE || session.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token is invalid or expired');
    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.write({ actorId: session.userId, action: 'auth.refresh_replay', resource: 'session', resourceId: session.id, outcome: 'DENIED', requestId, ipAddress, userAgent });
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const replacementId = randomUUID();
    const replacementToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.create({ data: { id: replacementId, userId: session.userId, tokenHash: this.hashToken(replacementToken), deviceId: session.deviceId, ipAddress, userAgent: userAgent.slice(0, 512), expiresAt } });
      // Create the replacement first so the self-referencing foreign key is valid
      // when the consumed session is linked to it.
      const result = await tx.refreshSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: replacementId, lastSeenAt: new Date() } });
      if (result.count !== 1) throw new UnauthorizedException('Refresh token is invalid or expired');
    });
    const accessToken = await this.jwt.signAsync({ sub: session.userId, sid: replacementId });
    return { accessToken, refreshToken: replacementToken, expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS') };
  }

  async logout(refreshToken: string, requestId: string = randomUUID(), ipAddress?: string, userAgent?: string): Promise<{ success: true }> {
    const result = await this.prisma.refreshSession.updateMany({ where: { tokenHash: this.hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ action: 'auth.logout', resource: 'session', outcome: 'SUCCESS', requestId, ipAddress, userAgent, metadata: { revoked: result.count } });
    return { success: true };
  }

  async logoutAll(principal: AuthenticatedPrincipal, requestId: string): Promise<{ revoked: number }> {
    const result = await this.prisma.refreshSession.updateMany({ where: { userId: principal.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ actorId: principal.id, action: 'auth.logout_all', resource: 'session', outcome: 'SUCCESS', requestId, metadata: { revoked: result.count } });
    return { revoked: result.count };
  }

  async currentUser(principal: AuthenticatedPrincipal) {
    const user = await this.prisma.user.findFirst({ where: { id: principal.id, deletedAt: null }, select: { id: true, username: true, email: true, status: true, profileImageKey: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { code: true, name: true, permissions: { select: { permission: { select: { code: true } } } } } } } }, permissions: { where: { granted: true }, select: { permission: { select: { code: true } } } } } });
    if (!user) throw new UnauthorizedException('Account is unavailable');
    return user;
  }

  async sessions(principal: AuthenticatedPrincipal) {
    return this.prisma.refreshSession.findMany({ where: { userId: principal.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, deviceId: true, deviceName: true, ipAddress: true, userAgent: true, lastSeenAt: true, expiresAt: true, createdAt: true }, orderBy: { lastSeenAt: 'desc' } });
  }

  async loginHistory(principal: AuthenticatedPrincipal) {
    return this.prisma.loginHistory.findMany({ where: { userId: principal.id }, select: { id: true, email: true, succeeded: true, reason: true, ipAddress: true, userAgent: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async revokeSession(principal: AuthenticatedPrincipal, sessionId: string, requestId: string) {
    const result = await this.prisma.refreshSession.updateMany({ where: { id: sessionId, userId: principal.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ actorId: principal.id, action: 'auth.session_revoke', resource: 'session', resourceId: sessionId, outcome: result.count ? 'SUCCESS' : 'DENIED', requestId });
    return { success: true };
  }

  async registerDevice(principal: AuthenticatedPrincipal, deviceId: string, fingerprint: string, deviceName: string | undefined, deviceToken: string | undefined, requestId: string) {
    const fingerprintHash = this.hashFingerprint(fingerprint);
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.refreshSession.updateMany({ where: { id: principal.sessionId, userId: principal.id, revokedAt: null }, data: { deviceId, deviceName, deviceToken } });
      if (!session.count) throw new UnauthorizedException('Session is no longer valid');
      const existing = await tx.trustedDevice.findUnique({ where: { userId_deviceId: { userId: principal.id, deviceId } }, select: { id: true } });
      if (!existing) {
        const activeCount = await tx.trustedDevice.count({ where: { userId: principal.id, status: 'ACTIVE' } });
        if (activeCount >= this.config.getOrThrow<number>('MAX_TRUSTED_DEVICES')) throw new UnauthorizedException('Trusted device limit reached');
      }
      return tx.trustedDevice.upsert({ where: { userId_deviceId: { userId: principal.id, deviceId } }, create: { userId: principal.id, deviceId, deviceName, fingerprintHash }, update: { deviceName, fingerprintHash, status: 'ACTIVE', revokedAt: null, lastSeenAt: new Date() } });
    });
    await this.audit.write({ actorId: principal.id, action: 'auth.device_register', resource: 'session', resourceId: principal.sessionId, outcome: 'SUCCESS', requestId, metadata: { deviceId } });
    return { success: true, trustedDeviceId: result.id };
  }

  async devices(principal: AuthenticatedPrincipal) {
    return this.prisma.trustedDevice.findMany({ where: { userId: principal.id }, select: { id: true, deviceId: true, deviceName: true, status: true, lastSeenAt: true, revokedAt: true, createdAt: true }, orderBy: { lastSeenAt: 'desc' } });
  }

  async revokeDevice(principal: AuthenticatedPrincipal, deviceId: string, requestId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const device = await tx.trustedDevice.updateMany({ where: { id: deviceId, userId: principal.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      if (device.count) await tx.playbackSession.updateMany({ where: { trustedDeviceId: deviceId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      return device;
    });
    if (!result.count) throw new UnauthorizedException('Trusted device is unavailable');
    await this.audit.write({ actorId: principal.id, action: 'auth.device_revoke', resource: 'trusted_device', resourceId: deviceId, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  async changePassword(principal: AuthenticatedPrincipal, currentPassword: string, newPassword: string, requestId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: principal.id, deletedAt: null }, select: { passwordHash: true } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: principal.id }, data: { passwordHash } }),
      this.prisma.refreshSession.updateMany({ where: { userId: principal.id, id: { not: principal.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.write({ actorId: principal.id, action: 'auth.password_change', resource: 'user', resourceId: principal.id, outcome: 'SUCCESS', requestId });
    return { success: true };
  }

  private async issueTokenPair(userId: string, deviceId: string | undefined, ipAddress: string, userAgent: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
    await this.prisma.refreshSession.create({ data: { id: sessionId, userId, tokenHash: this.hashToken(refreshToken), deviceId, ipAddress, userAgent: userAgent.slice(0, 512), expiresAt } });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId });
    return { accessToken, refreshToken, expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS') };
  }

  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private hashFingerprint(fingerprint: string): string { return createHash('sha256').update(fingerprint.trim()).digest('hex'); }
}
