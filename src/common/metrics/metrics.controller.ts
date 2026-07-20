import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/public.decorator';
import { MetricsService } from './metrics.service';
import { Req } from '@nestjs/common';
import { Request } from 'express';

@ApiTags('operations')
@Controller('internal/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService, private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics for the monitoring network' })
  @ApiProduces('text/plain; version=0.0.4')
  @ApiHeader({ name: 'X-Metrics-Token', required: true })
  getMetrics(@Req() request: Request): Promise<string> {
    const configured = this.config.get<string>('METRICS_TOKEN', '');
    const supplied = request.get('X-Metrics-Token') ?? '';
    const expected = Buffer.from(configured);
    const actual = Buffer.from(supplied);
    if (expected.length === 0 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Metrics access denied');
    }
    return this.metrics.metrics();
  }
}
