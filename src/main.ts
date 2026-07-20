import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { StructuredLoggerService } from './common/logging/structured-logger.service';

async function bootstrap(): Promise<void> {
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

void bootstrap();
