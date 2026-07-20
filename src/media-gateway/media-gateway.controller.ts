import { Controller, Get, Headers, Param, ParseUUIDPipe, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { Public } from '../common/auth/public.decorator';
import { PlaybackDeviceDto } from '../playback/dto/playback.dto';
import { MediaGatewayService, GatewayResponse } from './media-gateway.service';

@Public()
@ApiTags('Media Gateway')
@Controller('media-gateway')
export class MediaGatewayController {
  constructor(private readonly gateway: MediaGatewayService) {}

  @Get('sessions/:sessionId/manifest')
  @ApiOperation({ summary: 'Stream a capability-authorized manifest or MP4 body' })
  @ApiHeader({ name: 'Authorization', required: true, description: 'Bearer playback capability, not the account access token' })
  @ApiHeader({ name: 'x-device-id', required: true })
  @ApiHeader({ name: 'x-device-fingerprint', required: true })
  async manifest(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Headers('authorization') authorization: string, @Headers('x-device-id') deviceId: string, @Headers('x-device-fingerprint') fingerprint: string, @Headers('range') range: string | undefined, @Req() request: Request, @Res() response: Response) { const result = await this.gateway.manifest(sessionId, this.bearer(authorization), { deviceId, fingerprint }, range, request.requestId ?? 'missing-request-id'); return this.send(result, response); }

  @Get('sessions/:sessionId/resources/:resourceId')
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiHeader({ name: 'x-device-id', required: true })
  @ApiHeader({ name: 'x-device-fingerprint', required: true })
  async resource(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Param('resourceId', ParseUUIDPipe) resourceId: string, @Headers('authorization') authorization: string, @Headers('x-device-id') deviceId: string, @Headers('x-device-fingerprint') fingerprint: string, @Headers('range') range: string | undefined, @Req() request: Request, @Res() response: Response) { const result = await this.gateway.resource(sessionId, resourceId, this.bearer(authorization), { deviceId, fingerprint }, range, request.requestId ?? 'missing-request-id'); return this.send(result, response); }

  private bearer(value: string | undefined): string { const match = /^Bearer\s+(.+)$/i.exec(value ?? ''); if (!match) throw new UnauthorizedException('Playback capability header is required'); return match[1]; }
  private send(result: GatewayResponse, response: Response) { response.status(result.status).setHeader('content-type', result.contentType); if (result.contentLength) response.setHeader('content-length', result.contentLength); if (result.contentRange) response.setHeader('content-range', result.contentRange); if (result.acceptRanges) response.setHeader('accept-ranges', result.acceptRanges); if (result.streaming) { Readable.fromWeb(result.body as any).pipe(response); return; } response.send(result.body); }
}
