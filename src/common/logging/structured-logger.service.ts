import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StructuredLoggerService {
  private readonly minimumLevel: number;

  constructor(config: ConfigService) {
    const levels: Record<string, number> = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 };
    this.minimumLevel = levels[config.get<string>('LOG_LEVEL', 'info')] ?? levels.info;
  }

  private write(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
    const levels = { error: 1, warn: 2, info: 3 };
    if (levels[level] > this.minimumLevel) return;
    process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields })}\n`);
  }

  info(event: string, fields?: Record<string, unknown>): void { this.write('info', event, fields); }
  warn(event: string, fields?: Record<string, unknown>): void { this.write('warn', event, fields); }
  error(event: string, fields?: Record<string, unknown>): void { this.write('error', event, fields); }
}
