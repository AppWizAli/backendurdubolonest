import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedPrincipal } from './auth.types';
import { RoleCode, UserStatus } from '@prisma/client';

interface AccessTokenPayload {
  sub: string;
  sid: string;
  iat?: number;
  exp?: number;
  iss: string;
  aud: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const publicKey = Buffer.from(config.getOrThrow<string>('JWT_PUBLIC_KEY_B64'), 'base64').toString('utf8');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedPrincipal> {
    // Re-check the session and account on every protected request. Redis can cache
    // this result later, but revocation must remain enforceable immediately.
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null },
      },
      select: {
        user: {
          select: {
            id: true,
            status: true,
            roles: { select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
            permissions: { where: { granted: true }, select: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    if (!session || session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Authentication session is no longer valid');
    }

    const roles = session.user.roles.map((item) => item.role.code);
    const permissions = new Set<string>();
    for (const role of session.user.roles) {
      for (const item of role.role.permissions) permissions.add(item.permission.code);
    }
    for (const item of session.user.permissions) permissions.add(item.permission.code);

    return {
      id: session.user.id,
      sessionId: payload.sid,
      roles: roles as RoleCode[],
      permissions: [...permissions],
      status: session.user.status,
    };
  }
}
