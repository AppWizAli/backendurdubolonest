import { NotFoundException } from '@nestjs/common';
import { EpisodesService } from './episodes.service';

describe('EpisodesService', () => {
  it('requires an active season and drama relationship when creating an episode', async () => {
    const prisma = { season: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new EpisodesService(prisma, {} as never);
    await expect(service.create({ seasonId: '00000000-0000-0000-0000-000000000001', episodeNumber: 1 }, {} as never, 'request-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
