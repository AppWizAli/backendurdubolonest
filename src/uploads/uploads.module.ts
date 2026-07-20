import { Module } from '@nestjs/common';
import { AuditModule } from '../common/audit/audit.module';
import { RedisModule } from '../common/redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaGatewayModule } from '../media-gateway/media-gateway.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({ imports: [AuditModule, RedisModule, PrismaModule, MediaGatewayModule], controllers: [UploadsController], providers: [UploadsService] })
export class UploadsModule {}
