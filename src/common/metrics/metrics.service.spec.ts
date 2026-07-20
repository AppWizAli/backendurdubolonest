import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('publishes request and dependency metrics', async () => {
    const service = new MetricsService();
    service.observeHttp('GET', '/health/live', 200, 0.01);
    service.setDatabaseUp(true);
    service.setRedisUp(false);
    const output = await service.metrics();
    expect(output).toContain('urdubolo_http_requests_total');
    expect(output).toContain('urdubolo_database_up 1');
    expect(output).toContain('urdubolo_redis_up 0');
  });
});
