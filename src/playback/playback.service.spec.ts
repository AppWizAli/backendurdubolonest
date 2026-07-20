import { UnauthorizedException } from '@nestjs/common';
import { PlaybackService } from './playback.service';

const payload = { sub: 'user', uid: 'user', sid: 'session', jti: 'jti', eid: 'episode', mid: 'media', did: 'device', fp: 'fingerprint', typ: 'playback' as const };
const device = { deviceId: 'device', fingerprint: 'fingerprint-value-123456' };
const principal = { id: 'user', sessionId: 'access-session', roles: ['USER'], permissions: [], status: 'ACTIVE' } as never;

function serviceWith(token: any, prisma: any) { return new PlaybackService(prisma, { getOrThrow: jest.fn().mockReturnValue(120) } as any, { authorize: jest.fn().mockResolvedValue({ episodeId: 'episode', mediaAssetId: 'media' }) } as any, token, {} as any, { write: jest.fn().mockResolvedValue(undefined) } as any, {} as any, {} as any); }

describe('PlaybackService capability enforcement', () => {
  it('rejects a replayed or expired capability missing from Redis', async () => {
    const token = { verify: jest.fn().mockResolvedValue(payload), cached: jest.fn().mockResolvedValue(null), hash: jest.fn().mockReturnValue('hash') };
    const service = serviceWith(token, {} as any);
    await expect(service.validateCapability('session', 'token', device, principal, 'request-id')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked database session', async () => {
    const token = { verify: jest.fn().mockResolvedValue(payload), cached: jest.fn().mockResolvedValue({ sessionId: 'session', userId: 'user', fingerprintHash: 'fingerprint', expiresAt: new Date(Date.now() + 60_000).toISOString(), requestCount: 0 }), fingerprintHash: jest.fn().mockReturnValue('fingerprint'), hash: jest.fn().mockReturnValue('hash') };
    const prisma = { playbackSession: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = serviceWith(token, prisma);
    await expect(service.validateCapability('session', 'token', device, principal, 'request-id')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a device mismatch before media access is queried', async () => {
    const token = { verify: jest.fn().mockResolvedValue(payload), cached: jest.fn() };
    const prisma = { playbackSession: { findFirst: jest.fn() } };
    const service = serviceWith(token, prisma);
    await expect(service.validateCapability('session', 'token', { deviceId: 'other-device', fingerprint: 'fingerprint-value-123456' }, principal, 'request-id')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.playbackSession.findFirst).not.toHaveBeenCalled();
  });
});
