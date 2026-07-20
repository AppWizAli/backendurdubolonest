import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MetricsService } from '../common/metrics/metrics.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly metrics: MetricsService) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('live')
  live() { return { status: 'ok' }; }

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('ready')
  async ready() {
    let postgresReady = false;
    let redisReady = false;
    try { await this.prisma.$queryRaw`SELECT 1`; postgresReady = true; } catch { /* dependency status is returned generically */ }
    try { await this.redis.ping(); redisReady = true; } catch { /* dependency status is returned generically */ }
    this.metrics.setDatabaseUp(postgresReady);
    this.metrics.setRedisUp(redisReady);
    if (postgresReady && redisReady) {
      return { status: 'ok', dependencies: { postgres: 'ok', redis: 'ok' } };
    }
    throw new ServiceUnavailableException('Service is not ready');
  }
}
