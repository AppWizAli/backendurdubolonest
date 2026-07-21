import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisRateLimitGuard } from './redis-rate-limit.guard';

describe('RedisRateLimitGuard', () => {
  it('rejects requests after the configured Redis counter limit', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue({ limit: 1, windowSeconds: 60, scope: 'test' }) } as unknown as Reflector;
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(2) } as never;
    const request = { method: 'POST', path: '/test', ip: '127.0.0.1', route: { path: '/test' } };
    const execution = { getHandler: () => execution, getClass: () => execution, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await expect(new RedisRateLimitGuard(reflector, redis).canActivate(execution)).rejects.toThrow('Rate limit exceeded');
  });

  it('allows requests when Redis is temporarily unavailable', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue({ limit: 1, windowSeconds: 60, scope: 'test' }) } as unknown as Reflector;
    const redis = { incrementWithExpiry: jest.fn().mockRejectedValue(new Error('WRONGPASS invalid username-password pair')) } as never;
    const request = { method: 'GET', path: '/health/live', ip: '127.0.0.1', route: { path: '/health/live' } };
    const execution = { getHandler: () => execution, getClass: () => execution, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await expect(new RedisRateLimitGuard(reflector, redis).canActivate(execution)).resolves.toBe(true);
  });
});
