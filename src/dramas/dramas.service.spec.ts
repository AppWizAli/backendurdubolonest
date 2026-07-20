import { DramasService } from './dramas.service';

const actor = { id: '00000000-0000-0000-0000-000000000001', sessionId: '00000000-0000-0000-0000-000000000002', roles: ['ADMIN'], permissions: ['content.read', 'content.write'], status: 'ACTIVE' } as never;

describe('DramasService', () => {
  it('creates a normalized drama and records the change', async () => {
    const created = { id: '00000000-0000-0000-0000-000000000003', name: 'Test Drama', slug: 'test-drama', isPublished: false };
    const prisma = { drama: { create: jest.fn().mockResolvedValue(created) } } as any;
    const audit = { write: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new DramasService(prisma, audit);
    await expect(service.create({ name: ' Test Drama ', slug: 'test-drama' }, actor, 'request-id')).resolves.toEqual(created);
    expect(prisma.drama.create).toHaveBeenCalledWith({ data: { name: 'Test Drama', slug: 'test-drama', description: undefined, thumbnailKey: undefined, isPublished: false } });
    expect(audit.write).toHaveBeenCalled();
  });

  it('returns only published, non-deleted content to ordinary users', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'drama-1', isPublished: true, deletedAt: null }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { drama: { findMany, count }, $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)) } as any;
    const service = new DramasService(prisma, {} as any);
    await service.list({ page: 1, limit: 25, sort: 'createdAt', order: 'desc' }, { id: 'user', roles: ['USER'], permissions: [], sessionId: 'session', status: 'ACTIVE' });
    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null, isPublished: true });
  });
});
