import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../common/audit/audit.service';
import { RedisService } from '../common/redis/redis.service';
import { PlaybackDeviceDto } from '../playback/dto/playback.dto';
import { PlaybackService } from '../playback/playback.service';
import { PlaybackTokenService } from '../playback/playback-token.service';
import { MediaLocatorCipherService } from './media-locator-cipher.service';
import { StorageProviderAdapter } from './storage-provider.adapter';

interface MediaResourceState { sessionId: string; mediaAssetId: string; upstreamUrl: string; kind: 'manifest' | 'segment'; expiresAt: string; }
export interface GatewayResponse { status: number; contentType: string; contentLength?: string; contentRange?: string; acceptRanges?: string; body: string | ReadableStream<Uint8Array>; streaming: boolean; }

@Injectable()
export class MediaGatewayService {
  constructor(private readonly playback: PlaybackService, private readonly cipher: MediaLocatorCipherService, private readonly provider: StorageProviderAdapter, private readonly redis: RedisService, private readonly token: PlaybackTokenService, private readonly audit: AuditService) {}

  async manifest(sessionId: string, playbackToken: string, device: PlaybackDeviceDto, range: string | undefined, requestId: string): Promise<GatewayResponse> {
    const session = await this.playback.validateGatewayCapability(sessionId, playbackToken, device, requestId);
    const upstreamUrl = this.cipher.decrypt(session.mediaAsset.encryptedLocator);
    const response = await this.provider.fetch(upstreamUrl, range);
    if (session.mediaAsset.mediaType === 'MP4' || session.mediaAsset.mediaType === 'OTHER') return this.streamResponse(response);
    const source = await response.text();
    const body = session.mediaAsset.mediaType === 'DASH' ? await this.rewriteDash(source, upstreamUrl, sessionId, session.mediaAsset.id, this.expirySeconds(session.expiresAt)) : await this.rewriteHls(source, upstreamUrl, sessionId, session.mediaAsset.id, this.expirySeconds(session.expiresAt));
    return { status: 200, contentType: session.mediaAsset.mediaType === 'DASH' ? 'application/dash+xml' : 'application/vnd.apple.mpegurl', body, streaming: false };
  }

  async resource(sessionId: string, resourceId: string, playbackToken: string, device: PlaybackDeviceDto, range: string | undefined, requestId: string): Promise<GatewayResponse> {
    const session = await this.playback.validateGatewayCapability(sessionId, playbackToken, device, requestId);
    const resource = await this.redis.getJson<MediaResourceState>(this.token.resourceKey(resourceId));
    if (!resource || resource.sessionId !== sessionId || resource.mediaAssetId !== session.mediaAsset.id || new Date(resource.expiresAt) <= new Date()) throw new UnauthorizedException('Media resource is expired');
    const response = await this.provider.fetch(resource.upstreamUrl, range);
    if (resource.kind === 'manifest') {
      const source = await response.text();
      const body = session.mediaAsset.mediaType === 'DASH' ? await this.rewriteDash(source, resource.upstreamUrl, sessionId, session.mediaAsset.id, this.expirySeconds(session.expiresAt)) : await this.rewriteHls(source, resource.upstreamUrl, sessionId, session.mediaAsset.id, this.expirySeconds(session.expiresAt));
      return { status: 200, contentType: session.mediaAsset.mediaType === 'DASH' ? 'application/dash+xml' : 'application/vnd.apple.mpegurl', body, streaming: false };
    }
    return this.streamResponse(response);
  }

  private async rewriteHls(source: string, baseUrl: string, sessionId: string, mediaAssetId: string, ttl: number): Promise<string> {
    const lines = source.split(/\r?\n/);
    const rewritten: string[] = [];
    for (const line of lines) {
      if (!line.trim()) { rewritten.push(line); continue; }
      if (line.trim().startsWith('#')) { rewritten.push(await this.replaceUriAttributes(line, baseUrl, sessionId, mediaAssetId, ttl)); continue; }
      rewritten.push(await this.resourceUrl(new URL(line.trim(), baseUrl).toString(), sessionId, mediaAssetId, 'segment', ttl));
    }
    return rewritten.join('\n');
  }

  private async rewriteDash(source: string, baseUrl: string, sessionId: string, mediaAssetId: string, ttl: number): Promise<string> {
    let result = await this.replaceAsync(source, /(<BaseURL>)([^<]+)(<\/BaseURL>)/gi, async (match, open, uri, close) => `${open}${await this.resourceUrl(new URL(uri.trim(), baseUrl).toString(), sessionId, mediaAssetId, 'segment', ttl)}${close}`);
    result = await this.replaceAsync(result, /((?:media|initialization)=")([^"]+)(")/gi, async (match, open, uri, close) => `${open}${await this.resourceUrl(new URL(uri, baseUrl).toString(), sessionId, mediaAssetId, 'segment', ttl)}${close}`);
    return result;
  }

  private async replaceUriAttributes(line: string, baseUrl: string, sessionId: string, mediaAssetId: string, ttl: number): Promise<string> {
    return this.replaceAsync(line, /(URI=")([^"]+)(")/gi, async (match, open, uri, close) => `${open}${await this.resourceUrl(new URL(uri, baseUrl).toString(), sessionId, mediaAssetId, 'segment', ttl)}${close}`);
  }

  private async resourceUrl(upstreamUrl: string, sessionId: string, mediaAssetId: string, kind: 'manifest' | 'segment', ttl: number): Promise<string> { this.provider.validateUrl(upstreamUrl); const id = randomUUID(); const expiresAt = new Date(Date.now() + ttl * 1000).toISOString(); await this.redis.setJson(this.token.resourceKey(id), { sessionId, mediaAssetId, upstreamUrl, kind, expiresAt } satisfies MediaResourceState, ttl); return `/media-gateway/sessions/${sessionId}/resources/${id}`; }
  private async replaceAsync(value: string, expression: RegExp, replacer: (...args: string[]) => Promise<string>): Promise<string> { const matches = [...value.matchAll(expression)]; let output = ''; let cursor = 0; for (const match of matches) { output += value.slice(cursor, match.index); output += await replacer(...match); cursor = (match.index ?? 0) + match[0].length; } return output + value.slice(cursor); }
  private streamResponse(response: globalThis.Response): GatewayResponse { if (!response.body) throw new NotFoundException('Media provider returned an empty body'); return { status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', contentLength: response.headers.get('content-length') ?? undefined, contentRange: response.headers.get('content-range') ?? undefined, acceptRanges: response.headers.get('accept-ranges') ?? undefined, body: response.body, streaming: true }; }
  private expirySeconds(expiresAt: Date): number { return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)); }
}
