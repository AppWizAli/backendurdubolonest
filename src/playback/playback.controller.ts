import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { HeartbeatDto, PlaybackDeviceDto, PlaybackHistoryQueryDto, StopPlaybackDto } from './dto/playback.dto';
import { PlaybackService } from './playback.service';

@ApiTags('Playback') @ApiBearerAuth() @Controller('api/v1/playback')
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Post('episodes/:episodeId/session')
  @ApiOperation({ summary: 'Authorize and create a short-lived playback session' })
  start(@Param('episodeId', ParseUUIDPipe) episodeId: string, @Body() dto: PlaybackDeviceDto, @CurrentPrincipal() principal: AuthenticatedPrincipal, @Req() request: Request) { return this.playback.start(episodeId, dto, principal, this.context(request)); }

  @Post('sessions/:id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlaybackDeviceDto, @CurrentPrincipal() principal: AuthenticatedPrincipal, @Req() request: Request) { return this.playback.resume(id, dto, principal, this.context(request)); }

  @Post('sessions/:id/heartbeat')
  @ApiHeader({ name: 'x-playback-token', required: true })
  heartbeat(@Param('id', ParseUUIDPipe) id: string, @Headers('x-playback-token') token: string, @Body() dto: HeartbeatDto, @CurrentPrincipal() principal: AuthenticatedPrincipal, @Req() request: Request) { return this.playback.heartbeat(id, token ?? '', { deviceId: dto.deviceId, fingerprint: dto.fingerprint }, dto, principal, this.context(request)); }

  @Delete('sessions/:id')
  @ApiHeader({ name: 'x-playback-token', required: true })
  stop(@Param('id', ParseUUIDPipe) id: string, @Headers('x-playback-token') token: string, @Body() dto: StopPlaybackDto, @CurrentPrincipal() principal: AuthenticatedPrincipal, @Req() request: Request) { return this.playback.stop(id, token ?? '', dto, principal, this.context(request)); }

  @Get('sessions/:id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.playback.status(id, principal); }

  @Get('history')
  history(@Query() query: PlaybackHistoryQueryDto, @CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.playback.history(query, principal); }

  @Get('continue-watching')
  continueWatching(@Query() query: PlaybackHistoryQueryDto, @CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.playback.continueWatching(query, principal); }

  @Get('recent')
  recent(@Query() query: PlaybackHistoryQueryDto, @CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.playback.recent(query, principal); }

  private context(request: Request) { return { ipAddress: request.ip ?? 'unknown', userAgent: request.get('user-agent') ?? 'unknown', requestId: request.requestId ?? 'missing-request-id' }; }
}
