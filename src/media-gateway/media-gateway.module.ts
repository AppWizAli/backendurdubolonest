import { Module } from '@nestjs/common';
import { PlaybackModule } from '../playback/playback.module';
import { MediaGatewayController } from './media-gateway.controller';
import { MediaGatewayService } from './media-gateway.service';
import { MediaLocatorCipherService } from './media-locator-cipher.service';
import { StorageProviderAdapter } from './storage-provider.adapter';

@Module({ imports: [PlaybackModule], controllers: [MediaGatewayController], providers: [MediaGatewayService, MediaLocatorCipherService, StorageProviderAdapter], exports: [StorageProviderAdapter, MediaLocatorCipherService] })
export class MediaGatewayModule {}
