import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../src/common/auth/permission.guard';

describe('authorization integration contract', () => {
  it('denies a normal user from an administrative permission', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['users.status']) } as unknown as Reflector;
    const execution = { getHandler: () => execution, getClass: () => execution, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', sessionId: 's', roles: ['USER'], permissions: ['user.self'], status: 'ACTIVE' } }) }) } as unknown as ExecutionContext;
    expect(() => new PermissionGuard(reflector).canActivate(execution)).toThrow('Insufficient permissions');
  });
});
