import { ForbiddenException } from '@nestjs/common';
import { PlaybackPolicyService } from './playback-policy.service';

const principal = { id: '00000000-0000-0000-0000-000000000001', sessionId: '00000000-0000-0000-0000-000000000002', roles: ['USER'], permissions: [], status: 'ACTIVE' } as never;
const device = { deviceId: 'device-001', fingerprint: 'fingerprint-value-123456' };

function basePrisma() {
  return {
    episode: { findFirst: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000003', isPremium: true, mediaAsset: { id: '00000000-0000-0000-0000-000000000004', mediaType: 'HLS', encryptedLocator: 'v1.locator', status: 'ACTIVE', deletedAt: null } }) },
    trustedDevice: { findUnique: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000005', status: 'ACTIVE', fingerprintHash: 'fingerprint-hash' }) },
    playbackSession: { count: jest.fn().mockResolvedValue(0) },
  } as any;
}

describe('PlaybackPolicyService', () => {
  it('allows public non-premium episodes without subscription or explicit episode grant', async () => {
    const prisma = basePrisma();
    prisma.episode.findFirst.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000003', isPremium: false, mediaAsset: { id: '00000000-0000-0000-0000-000000000004', mediaType: 'MP4', encryptedLocator: 'v1.locator', status: 'ACTIVE', deletedAt: null } });
    const subscriptions = { validate: jest.fn() };
    const access = { validate: jest.fn() };
    const service = new PlaybackPolicyService(prisma, subscriptions as any, access as any, { getOrThrow: jest.fn().mockReturnValue(1) } as any, { fingerprintHash: jest.fn().mockReturnValue('fingerprint-hash') } as any, { write: jest.fn() } as any);
    await expect(service.authorize(principal, '00000000-0000-0000-0000-000000000003', device, false, 'request-id')).resolves.toMatchObject({ isPremium: false, mediaType: 'MP4' });
    expect(subscriptions.validate).not.toHaveBeenCalled();
    expect(access.validate).not.toHaveBeenCalled();
  });

  it('still requires subscription and episode access for premium episodes', async () => {
    const prisma = basePrisma();
    const service = new PlaybackPolicyService(prisma, { validate: jest.fn().mockResolvedValue({ active: false }) } as any, { validate: jest.fn().mockResolvedValue({ allowed: false }) } as any, { getOrThrow: jest.fn().mockReturnValue(1) } as any, { fingerprintHash: jest.fn().mockReturnValue('fingerprint-hash') } as any, { write: jest.fn() } as any);
    await expect(service.authorize(principal, '00000000-0000-0000-0000-000000000003', device, false, 'request-id')).rejects.toThrow('An active subscription is required');
  });

  it('rejects a second concurrent session at the configured limit', async () => {
    const prisma = basePrisma();
    prisma.playbackSession.count.mockResolvedValue(1);
    const token = { fingerprintHash: jest.fn().mockReturnValue('fingerprint-hash') } as any;
    const service = new PlaybackPolicyService(prisma, { validate: jest.fn().mockResolvedValue({ active: true }) } as any, { validate: jest.fn().mockResolvedValue({ allowed: true }) } as any, { getOrThrow: jest.fn().mockReturnValue(1) } as any, token, { write: jest.fn() } as any);
    await expect(service.authorize(principal, '00000000-0000-0000-0000-000000000003', device, false, 'request-id')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an untrusted or fingerprint-mismatched device', async () => {
    const prisma = basePrisma();
    prisma.trustedDevice.findUnique.mockResolvedValue({ id: 'device', status: 'ACTIVE', fingerprintHash: 'different-hash' });
    const service = new PlaybackPolicyService(prisma, { validate: jest.fn().mockResolvedValue({ active: true }) } as any, { validate: jest.fn().mockResolvedValue({ allowed: true }) } as any, { getOrThrow: jest.fn().mockReturnValue(1) } as any, { fingerprintHash: jest.fn().mockReturnValue('fingerprint-hash') } as any, { write: jest.fn() } as any);
    await expect(service.authorize(principal, '00000000-0000-0000-0000-000000000003', device, false, 'request-id')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
