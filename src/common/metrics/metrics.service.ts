import { Injectable } from '@nestjs/common';
import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequests = new Counter({
    name: 'urdubolo_http_requests_total',
    help: 'Total HTTP requests completed by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: 'urdubolo_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [this.registry],
  });
  private readonly databaseUp = new Gauge({
    name: 'urdubolo_database_up',
    help: 'Whether the last database health check succeeded.',
    registers: [this.registry],
  });
  private readonly redisUp = new Gauge({
    name: 'urdubolo_redis_up',
    help: 'Whether the last Redis health check succeeded.',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'urdubolo_' });
    this.databaseUp.set(0);
    this.redisUp.set(0);
  }

  observeHttp(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { method, route: this.normalizeRoute(route), status_code: String(statusCode) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  setDatabaseUp(value: boolean): void { this.databaseUp.set(value ? 1 : 0); }
  setRedisUp(value: boolean): void { this.redisUp.set(value ? 1 : 0); }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  private normalizeRoute(route: string): string {
    if (!route.startsWith('/')) return '/unmatched';
    return route
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,36}(?=\/|$)/gi, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}
