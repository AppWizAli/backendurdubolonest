import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AccessService } from '../access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { HeartbeatDto, PlaybackDeviceDto, PlaybackHistoryQueryDto } from './dto/playback.dto';
import { PlaybackPolicyService, PlaybackAuthorizationContext } from './playback-policy.service';
import { PlaybackCapabilityPayload, PlaybackTokenService } from './playback-token.service';

interface SessionRequestContext { ipAddress: string; userAgent: string; requestId: string; }

@Injectable()
export class PlaybackService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly policy: PlaybackPolicyService, private readonly token: PlaybackTokenService, private readonly redis: RedisService, private readonly audit: AuditService, private readonly subscriptions: SubscriptionsService, private readonly access: AccessService) {}

  async start(episodeId: string, device: PlaybackDeviceDto, principal: AuthenticatedPrincipal, request: SessionRequestContext) {
    const context = await this.policy.authorize(principal, episodeId, device, false, request.requestId);
    const existing = await this.prisma.playbackSession.findFirst({ where: { userId: principal.id, episodeId, trustedDeviceId: context.trustedDeviceId, status: 'ACTIVE', expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } });
    if (existing) return this.rotate(existing.id, context, principal, request);
    const sessionId = randomUUID();
    const jti = randomUUID();
    const issued = await this.issue(sessionId, jti, context);
    await this.prisma.$transaction(async (tx) => {
      await tx.playbackSession.create({ data: { id: sessionId, userId: principal.id, episodeId: context.episodeId, mediaAssetId: context.mediaAssetId, trustedDeviceId: context.trustedDeviceId, capabilityJti: jti, capabilityHash: this.token.hash(issued.token), deviceFingerprintHash: context.fingerprintHash, ipAddress: request.ipAddress, userAgent: request.userAgent.slice(0, 512), expiresAt: issued.expiresAt } });
      await tx.playbackHistory.upsert({ where: { userId_episodeId: { userId: principal.id, episodeId: context.episodeId } }, create: { userId: principal.id, episodeId: context.episodeId, playbackSessionId: sessionId, startedAt: new Date(), lastPositionSeconds: 0, watchedSeconds: 0 }, update: { playbackSessionId: sessionId, startedAt: new Date(), endedAt: null } });
    });
    await this.cacheCapability(issued.payload, context, issued.expiresAt);
    await this.audit.write({ actorId: principal.id, action: 'playback.started', resource: 'playback_session', resourceId: sessionId, outcome: 'SUCCESS', requestId: request.requestId, ipAddress: request.ipAddress, userAgent: request.userAgent, metadata: { episodeId, mediaType: context.mediaType } });
    return this.response(sessionId, issued.token, issued.expiresAt, context, 0);
  }

  async resume(sessionId: string, device: PlaybackDeviceDto, principal: AuthenticatedPrincipal, request: SessionRequestContext) {
    const session = await this.prisma.playbackSession.findFirst({ where: { id: sessionId, userId: principal.id, status: 'ACTIVE', expiresAt: { gt: new Date() } }, select: { id: true, episodeId: true, trustedDeviceId: true, lastPositionSeconds: true } });
    if (!session) throw new NotFoundException('Playback session is unavailable');
    const context = await this.policy.authorize(principal, session.episodeId, device, true, request.requestId);
    if (context.trustedDeviceId !== session.trustedDeviceId) throw new ForbiddenException('Playback device mismatch');
    const result = await this.rotate(session.id, context, principal, request);
    return { ...result, resumePositionSeconds: session.lastPositionSeconds };
  }

  async heartbeat(sessionId: string, playbackToken: string, device: PlaybackDeviceDto, dto: HeartbeatDto, principal: AuthenticatedPrincipal, request: SessionRequestContext) {
    const session = await this.validateCapability(sessionId, playbackToken, device, principal, request.requestId);
    const delta = Math.min(60, Math.max(0, dto.positionSeconds - session.lastPositionSeconds));
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.playbackSession.update({ where: { id: sessionId }, data: { lastSeenAt: new Date(), lastPositionSeconds: dto.positionSeconds, watchedSeconds: { increment: delta } } });
      await tx.playbackHeartbeat.create({ data: { playbackSessionId: sessionId, positionSeconds: dto.positionSeconds, bufferedSeconds: dto.bufferedSeconds } });
      await tx.playbackHistory.updateMany({ where: { playbackSessionId: sessionId }, data: { lastPositionSeconds: dto.positionSeconds, watchedSeconds: { increment: delta }, updatedAt: new Date() } });
      return updated;
    });
    return { sessionId: result.id, status: result.status, lastPositionSeconds: result.lastPositionSeconds, expiresAt: result.expiresAt };
  }

  async stop(sessionId: string, playbackToken: string, device: PlaybackDeviceDto, principal: AuthenticatedPrincipal, request: SessionRequestContext) {
    await this.validateCapability(sessionId, playbackToken, device, principal, request.requestId);
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.playbackSession.updateMany({ where: { id: sessionId, userId: principal.id, status: 'ACTIVE' }, data: { status: 'CLOSED', closedAt: now, lastSeenAt: now } });
      await tx.playbackHistory.updateMany({ where: { playbackSessionId: sessionId }, data: { endedAt: now, updatedAt: now } });
      return updated;
    });
    await this.revokeCachedCapability(sessionId);
    await this.audit.write({ actorId: principal.id, action: 'playback.ended', resource: 'playback_session', resourceId: sessionId, outcome: result.count ? 'SUCCESS' : 'DENIED', requestId: request.requestId });
    return { success: true };
  }

  async status(sessionId: string, principal: AuthenticatedPrincipal) {
    const session = await this.prisma.playbackSession.findFirst({ where: { id: sessionId, userId: principal.id }, select: { id: true, episodeId: true, status: true, startedAt: true, lastSeenAt: true, expiresAt: true, closedAt: true, revokedAt: true, lastPositionSeconds: true, watchedSeconds: true } });
    if (!session) throw new NotFoundException('Playback session not found');
    if (session.status === 'ACTIVE' && session.expiresAt <= new Date()) { await this.expire(session.id); return { ...session, status: 'EXPIRED' as const }; }
    return session;
  }

  async history(query: PlaybackHistoryQueryDto, principal: AuthenticatedPrincipal) { return this.historyQuery(query, principal, {}); }
  async continueWatching(query: PlaybackHistoryQueryDto, principal: AuthenticatedPrincipal) { return this.historyQuery(query, principal, { lastPositionSeconds: { gt: 0 } }); }
  async recent(query: PlaybackHistoryQueryDto, principal: AuthenticatedPrincipal) { return this.historyQuery(query, principal, {}); }

  async validateCapability(sessionId: string, playbackToken: string, device: PlaybackDeviceDto, principal: AuthenticatedPrincipal, requestId: string) {
    const payload = await this.token.verify(playbackToken);
    if (payload.sid !== sessionId || payload.uid !== principal.id || payload.did !== device.deviceId) throw new UnauthorizedException('Playback capability does not match this session');
    const cached = await this.token.cached(payload.jti);
    if (!cached || cached.sessionId !== sessionId || cached.userId !== principal.id) { await this.securityEvent(principal.id, sessionId, 'capability_replay_or_expiry', requestId); throw new UnauthorizedException('Playback capability has expired or was revoked'); }
    const fingerprintHash = this.token.fingerprintHash(device.fingerprint);
    if (payload.fp !== fingerprintHash || cached.fingerprintHash !== fingerprintHash) { await this.revokeBySession(sessionId, principal.id, 'device_mismatch'); throw new UnauthorizedException('Playback device validation failed'); }
    const policy = await this.policy.authorize(principal, payload.eid, device, true, requestId);
    if (policy.mediaAssetId !== payload.mid || policy.episodeId !== payload.eid) { await this.revokeBySession(sessionId, principal.id, 'capability_scope_mismatch'); throw new UnauthorizedException('Playback capability scope is invalid'); }
    const session = await this.prisma.playbackSession.findFirst({ where: { id: sessionId, userId: principal.id, capabilityJti: payload.jti, capabilityHash: this.token.hash(playbackToken), status: 'ACTIVE', expiresAt: { gt: new Date() }, trustedDevice: { status: 'ACTIVE', deviceId: device.deviceId, fingerprintHash } }, select: { id: true, userId: true, episodeId: true, mediaAssetId: true, trustedDeviceId: true, lastPositionSeconds: true, expiresAt: true, status: true, mediaAsset: { select: { id: true, encryptedLocator: true, mediaType: true, status: true, deletedAt: true } } } });
    if (!session || session.mediaAsset.status !== 'ACTIVE' || session.mediaAsset.deletedAt) { await this.securityEvent(principal.id, sessionId, 'capability_session_invalid', requestId); throw new UnauthorizedException('Playback session is no longer valid'); }
    const now = new Date();
    const remaining = Math.max(1, Math.ceil((new Date(cached.expiresAt).getTime() - now.getTime()) / 1000));
    await this.token.cache(payload, { ...cached, lastSeenAt: now.toISOString(), requestCount: cached.requestCount + 1 }, remaining);
    await this.prisma.playbackSession.update({ where: { id: sessionId }, data: { lastSeenAt: now } });
    return session;
  }

  async validateGatewayCapability(sessionId: string, playbackToken: string, device: PlaybackDeviceDto, requestId: string) {
    const payload = await this.token.verify(playbackToken);
    const user = await this.prisma.user.findFirst({ where: { id: payload.uid, status: 'ACTIVE', deletedAt: null }, select: { id: true, status: true } });
    if (!user) throw new UnauthorizedException('Playback account is unavailable');
    return this.validateCapability(sessionId, playbackToken, device, { id: user.id, sessionId: 'gateway', roles: [], permissions: [], status: user.status }, requestId);
  }

  private async rotate(sessionId: string, context: PlaybackAuthorizationContext, principal: AuthenticatedPrincipal, request: SessionRequestContext) {
    const current = await this.prisma.playbackSession.findUniqueOrThrow({ where: { id: sessionId }, select: { capabilityJti: true, lastPositionSeconds: true } });
    const jti = randomUUID();
    const issued = await this.issue(sessionId, jti, context);
    await this.prisma.playbackSession.update({ where: { id: sessionId }, data: { capabilityJti: jti, capabilityHash: this.token.hash(issued.token), deviceFingerprintHash: context.fingerprintHash, expiresAt: issued.expiresAt, lastSeenAt: new Date(), ipAddress: request.ipAddress, userAgent: request.userAgent.slice(0, 512) } });
    await this.token.revoke(current.capabilityJti);
    await this.cacheCapability(issued.payload, context, issued.expiresAt);
    await this.audit.write({ actorId: principal.id, action: 'playback.resumed', resource: 'playback_session', resourceId: sessionId, outcome: 'SUCCESS', requestId: request.requestId, metadata: { episodeId: context.episodeId } });
    return this.response(sessionId, issued.token, issued.expiresAt, context, current.lastPositionSeconds);
  }

  private async issue(sessionId: string, jti: string, context: PlaybackAuthorizationContext) {
    const issued = await this.token.issue({ sub: context.userId, sid: sessionId, jti, uid: context.userId, eid: context.episodeId, mid: context.mediaAssetId, did: context.deviceId, fp: context.fingerprintHash });
    return { ...issued, payload: await this.token.verify(issued.token) };
  }

  private async cacheCapability(payload: PlaybackCapabilityPayload, context: PlaybackAuthorizationContext, expiresAt: Date) { await this.token.cache(payload, { sessionId: payload.sid, userId: context.userId, deviceId: context.deviceId, fingerprintHash: context.fingerprintHash, mediaAssetId: context.mediaAssetId, episodeId: context.episodeId, expiresAt: expiresAt.toISOString(), lastSeenAt: new Date().toISOString(), requestCount: 0 }, this.config.getOrThrow<number>('PLAYBACK_CAPABILITY_TTL_SECONDS')); }
  private response(sessionId: string, token: string, expiresAt: Date, context: PlaybackAuthorizationContext, resumePositionSeconds: number) { const base = this.config.getOrThrow<string>('MEDIA_GATEWAY_PUBLIC_URL').replace(/\/$/, ''); return { playbackSessionId: sessionId, playbackToken: token, gatewayUrl: `${base}/sessions/${sessionId}/manifest`, expiresAt, mediaType: context.mediaType, isPremium: context.isPremium, resumePositionSeconds }; }

  private async historyQuery(query: PlaybackHistoryQueryDto, principal: AuthenticatedPrincipal, extra: Prisma.PlaybackHistoryWhereInput) { const where: Prisma.PlaybackHistoryWhereInput = { userId: principal.id, ...(query.episodeId ? { episodeId: query.episodeId } : {}), ...extra }; const [items, total] = await this.prisma.$transaction([this.prisma.playbackHistory.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, episodeId: true, lastPositionSeconds: true, watchedSeconds: true, startedAt: true, endedAt: true, updatedAt: true, episode: { select: { id: true, episodeNumber: true, title: true, thumbnailKey: true, isPremium: true, season: { select: { seasonNumber: true, drama: { select: { id: true, name: true, slug: true } } } } } } } }), this.prisma.playbackHistory.count({ where })]); return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }; }
  private async expire(id: string) { await this.prisma.playbackSession.updateMany({ where: { id, status: 'ACTIVE', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); await this.prisma.playbackHistory.updateMany({ where: { playbackSessionId: id, endedAt: null }, data: { endedAt: new Date() } }); await this.revokeBySession(id, undefined, 'expired'); }
  private async revokeBySession(id: string, userId: string | undefined, reason: string) { const session = await this.prisma.playbackSession.findFirst({ where: { id, ...(userId ? { userId } : {}) }, select: { capabilityJti: true, userId: true } }); if (session) { await this.prisma.playbackSession.update({ where: { id }, data: { status: reason === 'expired' ? 'EXPIRED' : 'REVOKED', revokedAt: reason === 'expired' ? null : new Date() } }); await this.token.revoke(session.capabilityJti); await this.audit.write({ actorId: session.userId, action: `playback.${reason}`, resource: 'playback_session', resourceId: id, outcome: 'DENIED', requestId: 'playback-security' }); } }
  private async revokeCachedCapability(id: string) { const session = await this.prisma.playbackSession.findUnique({ where: { id }, select: { capabilityJti: true } }); if (session) await this.token.revoke(session.capabilityJti); }
  private async securityEvent(actorId: string, sessionId: string, reason: string, requestId: string) { await this.audit.write({ actorId, action: 'playback.security_violation', resource: 'playback_session', resourceId: sessionId, outcome: 'DENIED', requestId, metadata: { reason } }); }
}
