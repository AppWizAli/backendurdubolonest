import { LegacyService } from './legacy.service';

describe('LegacyService business parity', () => {
  const actor = { id: 'user-1', roles: [], permissions: ['users.read'] } as any;

  it('creates notifications with normalized text and audit trace', async () => {
    const notification = { id: 'notification-1', title: 'Title', message: 'Body' };
    const prisma = { notification: { create: jest.fn().mockResolvedValue(notification) } };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new LegacyService(prisma as any, audit as any, {} as any, {} as any);

    await expect(service.createNotification({ title: ' Title ', message: ' Body ' }, actor, 'request-1')).resolves.toEqual(notification);
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: { createdById: actor.id, title: 'Title', message: 'Body', imageKey: undefined } });
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'legacy.notification_create', requestId: 'request-1' }));
  });

  it('returns a safe default when a user has no security block', async () => {
    const prisma = { securityBlock: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new LegacyService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.getSecurityBlock(actor)).resolves.toEqual({ isBlocked: false, message: null });
  });
});
