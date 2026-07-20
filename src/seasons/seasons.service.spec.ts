import { NotFoundException } from '@nestjs/common';
import { SeasonsService } from './seasons.service';

describe('SeasonsService', () => {
  it('rejects a season whose drama is missing or deleted', async () => {
    const prisma = { drama: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new SeasonsService(prisma, {} as never);
    await expect(service.create({ dramaId: '00000000-0000-0000-0000-000000000001', seasonNumber: 1 }, {} as never, 'request-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
