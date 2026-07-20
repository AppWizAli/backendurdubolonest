import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { AuditService } from './audit.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { AuthenticatedPrincipal } from '../auth/auth.types';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService, private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const input = { actorId: request.user?.id, action: 'http.request', resource: (request.route?.path ?? request.path).slice(0, 120), outcome: 'SUCCESS' as const, requestId: request.requestId ?? randomUUID(), ipAddress: request.ip, userAgent: request.get('user-agent'), metadata: { method: request.method, path: request.path } };
    return next.handle().pipe(
      tap(() => { void this.record(input, response.statusCode); }),
      catchError((error: unknown) => { const status = error instanceof HttpException ? error.getStatus() : 500; void this.record({ ...input, outcome: status < 500 ? 'DENIED' as const : 'FAILURE' as const }, status); return throwError(() => error); }),
    );
  }

  private async record(input: Parameters<AuditService['write']>[0], statusCode: number): Promise<void> {
    try { await this.audit.write({ ...input, metadata: { ...(input.metadata as Record<string, unknown>), statusCode } }); } catch (error) { this.logger.warn('audit_write_failed', { message: error instanceof Error ? error.message : 'unknown_error', action: input.action }); }
  }
}
