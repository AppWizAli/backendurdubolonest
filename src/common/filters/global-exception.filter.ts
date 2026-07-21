import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { StructuredLoggerService } from '../logging/structured-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    this.logger.error('http_exception', {
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      statusCode: status,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: status < 500 && error instanceof Error ? error.message : undefined,
    });

    // Do not leak SQL, filesystem, JWT, provider, or stack-trace details to clients.
    const message = status < 500 && error instanceof HttpException
      ? this.message(error.getResponse())
      : undefined;
    response.status(status).json({
      statusCode: status,
      error: status >= 500 ? 'Internal server error' : 'Request rejected',
      ...(message ? { message } : {}),
      requestId: request.requestId,
    });
  }

  private message(value: string | object): string | undefined {
    if (typeof value === 'string') return value;
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) return message.join('; ');
    return undefined;
  }
}
