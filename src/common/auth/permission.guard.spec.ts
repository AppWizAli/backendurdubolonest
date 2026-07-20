import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

function context(user: unknown): ExecutionContext { return { getHandler: () => context, getClass: () => context, switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext; }

describe('PermissionGuard', () => {
  it('allows a super admin without enumerating each permission', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['users.delete']) } as unknown as Reflector;
    expect(new PermissionGuard(reflector).canActivate(context({ id: '1', roles: ['SUPER_ADMIN'], permissions: [], sessionId: 's', status: 'ACTIVE' }))).toBe(true);
  });

  it('requires every declared permission', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['users.read', 'users.write']) } as unknown as Reflector;
    expect(() => new PermissionGuard(reflector).canActivate(context({ id: '1', roles: ['ADMIN'], permissions: ['users.read'], sessionId: 's', status: 'ACTIVE' }))).toThrow('Insufficient permissions');
  });
});
