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
    });

    // Do not leak SQL, filesystem, JWT, provider, or stack-trace details to clients.
    response.status(status).json({
      statusCode: status,
      error: status >= 500 ? 'Internal server error' : 'Request rejected',
      requestId: request.requestId,
    });
  }
}
