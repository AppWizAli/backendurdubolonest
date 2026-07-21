import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlaybackDeviceDto } from './dto/playback.dto';
import { PlaybackTokenService } from './playback-token.service';

export interface PlaybackAuthorizationContext {
  userId: string;
  episodeId: string;
  mediaAssetId: string;
  mediaType: 'MP4' | 'HLS' | 'DASH' | 'OTHER';
  encryptedLocator: string;
  isPremium: boolean;
  trustedDeviceId: string;
  fingerprintHash: string;
  deviceId: string;
}

@Injectable()
export class PlaybackPolicyService {
  constructor(private readonly prisma: PrismaService, private readonly subscriptions: SubscriptionsService, private readonly access: AccessService, private readonly config: ConfigService, private readonly token: PlaybackTokenService, private readonly audit: AuditService) {}

  async authorize(principal: AuthenticatedPrincipal, episodeId: string, device: PlaybackDeviceDto, allowExistingSession = false, requestId = 'playback-policy'): Promise<PlaybackAuthorizationContext> {
    if (principal.status !== 'ACTIVE') throw new ForbiddenException('Account is not active');
    const episode = await this.prisma.episode.findFirst({ where: { id: episodeId, deletedAt: null, isPublished: true, status: 'PUBLISHED', visibility: 'PUBLIC', season: { deletedAt: null, drama: { deletedAt: null, isPublished: true } } }, select: { id: true, isPremium: true, mediaAsset: { select: { id: true, mediaType: true, encryptedLocator: true, status: true, deletedAt: true } } } });
    if (!episode) throw new NotFoundException('Published episode not found');
    if (!episode.mediaAsset || episode.mediaAsset.deletedAt || episode.mediaAsset.status !== 'ACTIVE') throw new ForbiddenException('Media is not available');

    if (episode.isPremium) {
      const subscription = await this.subscriptions.validate(principal.id);
      if (!subscription.active) { await this.denied(principal.id, episodeId, 'subscription_missing', requestId); throw new ForbiddenException('An active subscription is required'); }
      const grant = await this.access.validate(episodeId, principal);
      if (!grant.allowed) { await this.denied(principal.id, episodeId, 'episode_access_missing', requestId); throw new ForbiddenException('Episode access is not granted'); }
    }

    const fingerprintHash = this.token.fingerprintHash(device.fingerprint);
    const trustedDevice = await this.prisma.trustedDevice.findUnique({ where: { userId_deviceId: { userId: principal.id, deviceId: device.deviceId } }, select: { id: true, status: true, fingerprintHash: true } });
    if (!trustedDevice || trustedDevice.status !== 'ACTIVE') { await this.denied(principal.id, episodeId, 'device_not_trusted', requestId); throw new ForbiddenException('Trusted device is required'); }
    if (trustedDevice.fingerprintHash !== fingerprintHash) { await this.denied(principal.id, episodeId, 'device_fingerprint_mismatch', requestId); throw new ForbiddenException('Device validation failed'); }

    const now = new Date();
    const activeSessions = allowExistingSession ? 0 : await this.prisma.playbackSession.count({ where: { userId: principal.id, status: 'ACTIVE', expiresAt: { gt: now }, NOT: { episodeId, trustedDeviceId: trustedDevice.id } } });
    if (!allowExistingSession && activeSessions >= this.config.getOrThrow<number>('MAX_CONCURRENT_PLAYBACK_SESSIONS')) { await this.denied(principal.id, episodeId, 'concurrent_session_limit', requestId); throw new ForbiddenException('Concurrent playback limit reached'); }
    return { userId: principal.id, episodeId: episode.id, mediaAssetId: episode.mediaAsset.id, mediaType: episode.mediaAsset.mediaType, encryptedLocator: episode.mediaAsset.encryptedLocator, isPremium: episode.isPremium, trustedDeviceId: trustedDevice.id, fingerprintHash, deviceId: device.deviceId };
  }

  private async denied(actorId: string, episodeId: string, reason: string, requestId: string): Promise<void> {
    process.stderr.write(JSON.stringify({ level: 'warn', event: 'playback_authorization_denied', actorId, episodeId, reason, requestId }) + '\n');
    try { await this.audit.write({ actorId, action: 'playback.authorization_denied', resource: 'episode', resourceId: episodeId, outcome: 'DENIED', requestId, metadata: { reason } }); } catch { /* Request rejection must not leak audit storage details. */ }
  }
}
