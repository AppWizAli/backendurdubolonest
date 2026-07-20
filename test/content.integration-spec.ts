import { Test } from '@nestjs/testing';
import { DramasController } from '../src/dramas/dramas.controller';
import { DramasService } from '../src/dramas/dramas.service';

describe('content controller integration contract', () => {
  it('connects the authenticated drama listing route to the business service', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
    const module = await Test.createTestingModule({ controllers: [DramasController], providers: [{ provide: DramasService, useValue: { list } }] }).compile();
    const controller = module.get(DramasController);
    await controller.list({ page: 1, limit: 25, sort: 'createdAt', order: 'desc' }, { id: 'user', sessionId: 'session', roles: ['USER'], permissions: [], status: 'ACTIVE' });
    expect(list).toHaveBeenCalled();
  });
});
