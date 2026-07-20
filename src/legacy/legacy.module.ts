import { Module } from '@nestjs/common';
import { MediaGatewayModule } from '../media-gateway/media-gateway.module';
import { LegacyController } from './legacy.controller';
import { LegacyService } from './legacy.service';
import { FirebasePushService } from './firebase-push.service';

@Module({ imports: [MediaGatewayModule], controllers: [LegacyController], providers: [LegacyService, FirebasePushService], exports: [FirebasePushService] })
export class LegacyModule {}
