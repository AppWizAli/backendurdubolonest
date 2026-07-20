import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { StructuredLoggerService } from './structured-logger.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService, private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const started = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const route = request.route?.path ? `${request.baseUrl}${request.route.path}` : request.path;
      this.metrics.observeHttp(request.method, route, response.statusCode, durationMs / 1000);
      this.logger.info('http_request', {
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: request.ip,
        userAgent: request.get('user-agent')?.slice(0, 160),
      });
    });
    next();
  }
}
