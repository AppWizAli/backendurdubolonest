import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { StructuredLoggerModule } from './common/logging/structured-logger.module';
import { RedisModule } from './common/redis/redis.module';
import { RedisRateLimitGuard } from './common/security/redis-rate-limit.guard';
import { PermissionGuard } from './common/auth/permission.guard';
import { AuditModule } from './common/audit/audit.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AccessModule } from './access/access.module';
import { AuditLoggingInterceptor } from './common/audit/audit-logging.interceptor';
import { DramasModule } from './dramas/dramas.module';
import { SeasonsModule } from './seasons/seasons.module';
import { EpisodesModule } from './episodes/episodes.module';
import { MediaAssetsModule } from './media-assets/media-assets.module';
import { PlaybackModule } from './playback/playback.module';
import { MediaGatewayModule } from './media-gateway/media-gateway.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { LegacyModule } from './legacy/legacy.module';
import { AdminToolsModule } from './admin-tools/admin-tools.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema: envValidationSchema }),
    StructuredLoggerModule,
    RedisModule,
    AuditModule,
    HealthModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    RbacModule,
    SubscriptionsModule,
    AccessModule,
    DramasModule,
    SeasonsModule,
    EpisodesModule,
    MediaAssetsModule,
    PlaybackModule,
    MediaGatewayModule,
    MetricsModule,
    LegacyModule,
    AdminToolsModule,
    UploadsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: RedisRateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLoggingInterceptor },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, RequestLoggingMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
