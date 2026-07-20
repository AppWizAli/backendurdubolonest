import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeSync } from 'node:fs';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { StructuredLoggerService } from './common/logging/structured-logger.service';

const requiredBootEnvKeys = [
  'DATABASE_URL',
  'REDIS_URL',
  'PUBLIC_API_ORIGIN',
  'ADMIN_WEB_ORIGIN',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'JWT_PRIVATE_KEY_B64',
  'JWT_PUBLIC_KEY_B64',
  'METRICS_TOKEN',
  'ARGON2_DUMMY_HASH',
  'MEDIA_GATEWAY_PUBLIC_URL',
  'MEDIA_LOCATOR_ENCRYPTION_KEY_B64',
  'MEDIA_PROVIDER_ALLOWED_HOSTS',
  'MEDIA_PROVIDER_ORIGIN_SECRET',
] as const;

function serializeFailure(error: unknown): Record<string, unknown> {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { error };
}

function fatal(event: string, payload: Record<string, unknown> = {}): never {
  const line = `${JSON.stringify({ level: 'fatal', event, ...payload })}\n`;
  writeSync(1, line);
  writeSync(2, line);
  process.exit(1);
}

function preflightEnvironment(): void {
  const missing = requiredBootEnvKeys.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    fatal('missing_boot_env', { missing });
  }
}

function preflightSecrets(): void {
  const invalid: string[] = [];

  const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_B64 ?? '', 'base64').toString('utf8');
  if (!privateKey.includes('BEGIN PRIVATE KEY')) invalid.push('JWT_PRIVATE_KEY_B64');

  const publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY_B64 ?? '', 'base64').toString('utf8');
  if (!publicKey.includes('BEGIN PUBLIC KEY')) invalid.push('JWT_PUBLIC_KEY_B64');

  const locatorKey = Buffer.from(process.env.MEDIA_LOCATOR_ENCRYPTION_KEY_B64 ?? '', 'base64');
  if (locatorKey.length !== 32) invalid.push('MEDIA_LOCATOR_ENCRYPTION_KEY_B64');

  if (invalid.length > 0) {
    fatal('invalid_boot_env', { invalid });
  }
}

async function bootstrap(): Promise<void> {
  const missing = requiredBootEnvKeys.filter((key) => !process.env[key]?.trim());
  const entryLine = `${JSON.stringify({
    level: 'info',
    event: 'bootstrap_entry',
    port: process.env.PORT ?? null,
    missingBootEnv: missing,
  })}\n`;
  writeSync(1, entryLine);
  writeSync(2, entryLine);
  preflightEnvironment();
  preflightSecrets();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: false,
  });
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Helmet must be registered before routes so every response receives the headers.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  app.use(compression());
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', config.get<number>('TRUSTED_PROXY_HOPS', 0));
  app.enableShutdownHooks();

  app.use(express.json({ limit: '64kb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // CORS is an allowlist, never '*'. Mobile clients do not need browser CORS.
  app.enableCors({
    origin: [config.getOrThrow<string>('PUBLIC_API_ORIGIN'), config.getOrThrow<string>('ADMIN_WEB_ORIGIN')],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  });

  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    validationError: { target: false, value: false },
    disableErrorMessages: isProduction,
  }));
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(StructuredLoggerService)));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (config.get<boolean>('ENABLE_SWAGGER', false)) {
    // Swagger is an internal review tool only. Keep it disabled in production
    // unless the route is additionally protected by network and staff controls.
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Urdu Bolo API')
      .setDescription('Versioned API contract for internal security review')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('internal/docs', app, document, { jsonDocumentUrl: 'internal/docs/openapi.json' });
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
}

process.on('uncaughtException', (error: unknown) => fatal('uncaught_exception', serializeFailure(error)));
process.on('unhandledRejection', (reason: unknown) => fatal('unhandled_rejection', serializeFailure(reason)));

void bootstrap().catch((error: unknown) => {
  fatal('bootstrap_failed', serializeFailure(error));
});
