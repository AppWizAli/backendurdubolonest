import { Module } from '@nestjs/common';
import { MediaGatewayModule } from '../media-gateway/media-gateway.module';
import { MediaAssetsController } from './media-assets.controller';
import { MediaAssetsService } from './media-assets.service';
@Module({ imports: [MediaGatewayModule], controllers: [MediaAssetsController], providers: [MediaAssetsService], exports: [MediaAssetsService] })
export class MediaAssetsModule {}
