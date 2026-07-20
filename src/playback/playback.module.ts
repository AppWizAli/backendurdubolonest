import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessModule } from '../access/access.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PlaybackController } from './playback.controller';
import { PlaybackPolicyService } from './playback-policy.service';
import { PlaybackService } from './playback.service';
import { PlaybackTokenService } from './playback-token.service';

@Module({
  imports: [ConfigModule, AccessModule, SubscriptionsModule, JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({}) })],
  controllers: [PlaybackController],
  providers: [PlaybackTokenService, PlaybackPolicyService, PlaybackService],
  exports: [PlaybackTokenService, PlaybackPolicyService, PlaybackService],
})
export class PlaybackModule {}
