import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly defaultLimit: RateLimitOptions = { limit: 120, windowSeconds: 60, scope: 'global' };

  constructor(private readonly reflector: Reflector, private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]) ?? this.defaultLimit;
    const request = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const actor = request.user?.id ?? request.ip ?? 'unknown';
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const scope = options.scope ?? 'route';
    const key = `rl:${scope}:${route}:${actor}`;
    const count = await this.redis.incrementWithExpiry(key, options.windowSeconds);
    if (count > options.limit) throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
