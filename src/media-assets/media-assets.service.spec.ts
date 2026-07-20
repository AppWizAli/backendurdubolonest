import { MediaAssetsService } from './media-assets.service';

describe('MediaAssetsService', () => {
  it('does not return the encrypted provider locator', async () => {
    const row = { id: '00000000-0000-0000-0000-000000000001', episodeId: '00000000-0000-0000-0000-000000000002', kind: 'HLS', mediaType: 'HLS', provider: 'private-storage', checksum: null, status: 'ACTIVE', metadata: null, version: 1, durationSeconds: null, sizeBytes: 100n, createdAt: new Date(), updatedAt: new Date(), rotatedAt: null, deletedAt: null };
    const prisma = { episode: { findFirst: jest.fn().mockResolvedValue({ id: row.episodeId }) }, mediaAsset: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(row) } } as never;
    const service = new MediaAssetsService(prisma, { write: jest.fn().mockResolvedValue(undefined) } as never, { decrypt: jest.fn() } as never, { validateUrl: jest.fn() } as never);
    const result = await service.create({ episodeId: row.episodeId, mediaType: 'HLS', provider: 'private-storage', encryptedLocator: 'encrypted-locator-value' }, {} as never, 'request-id');
    expect(result).not.toHaveProperty('encryptedLocator');
    expect(result.sizeBytes).toBe('100');
  });
});
