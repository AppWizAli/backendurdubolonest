import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('does not reveal whether an account exists on invalid login', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      loginHistory: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    } as never;
    const jwt = {} as never;
    const config = { getOrThrow: jest.fn((key: string) => key === 'ARGON2_DUMMY_HASH' ? '$argon2id$v=19$m=65536,t=3,p=1$invalid$invalid' : 30) } as never;
    const audit = { write: jest.fn().mockResolvedValue(undefined) } as never;
    const service = new AuthService(prisma, jwt, config, audit);
    await expect(service.login({ email: 'unknown@example.com', password: 'wrong-password' }, '127.0.0.1', 'test-agent', 'request-id')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
