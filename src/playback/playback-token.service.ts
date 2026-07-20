import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { RedisService } from '../common/redis/redis.service';

export interface PlaybackCapabilityPayload {
  sub: string;
  sid: string;
  jti: string;
  uid: string;
  eid: string;
  mid: string;
  did: string;
  fp: string;
  typ: 'playback';
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface PlaybackCapabilityState {
  sessionId: string;
  userId: string;
  deviceId: string;
  fingerprintHash: string;
  mediaAssetId: string;
  episodeId: string;
  expiresAt: string;
  lastSeenAt: string;
  requestCount: number;
}

@Injectable()
export class PlaybackTokenService {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService, private readonly redis: RedisService) {}

  async issue(payload: Omit<PlaybackCapabilityPayload, 'typ'>): Promise<{ token: string; expiresAt: Date }> {
    const ttl = this.config.getOrThrow<number>('PLAYBACK_CAPABILITY_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const token = await this.jwt.signAsync({ ...payload, typ: 'playback' }, { privateKey: this.privateKey(), algorithm: 'RS256', issuer: this.config.getOrThrow<string>('JWT_ISSUER'), audience: 'urdubolo-media-gateway', expiresIn: ttl });
    return { token, expiresAt };
  }

  async verify(token: string): Promise<PlaybackCapabilityPayload> {
    try {
      const payload = await this.jwt.verifyAsync<PlaybackCapabilityPayload>(token, { publicKey: this.publicKey(), algorithms: ['RS256'], issuer: this.config.getOrThrow<string>('JWT_ISSUER'), audience: 'urdubolo-media-gateway' });
      if (payload.typ !== 'playback' || payload.sub !== payload.uid || !payload.sid || !payload.jti || !payload.did || !payload.fp) throw new UnauthorizedException('Playback capability is invalid');
      return payload;
    } catch { throw new UnauthorizedException('Playback capability is invalid or expired'); }
  }

  async cache(payload: PlaybackCapabilityPayload, state: PlaybackCapabilityState, ttlSeconds: number): Promise<void> { await this.redis.setJson(this.cacheKey(payload.jti), state, ttlSeconds); }
  async cached(jti: string): Promise<PlaybackCapabilityState | null> { return this.redis.getJson<PlaybackCapabilityState>(this.cacheKey(jti)); }
  async revoke(jti: string): Promise<void> { await this.redis.delete(this.cacheKey(jti)); }
  hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  fingerprintHash(fingerprint: string): string { return createHash('sha256').update(fingerprint.trim()).digest('hex'); }
  resourceKey(id: string): string { return `playback:resource:${id}`; }
  cacheKey(jti: string): string { return `playback:capability:${jti}`; }
  private privateKey(): string { return Buffer.from(this.config.getOrThrow<string>('JWT_PRIVATE_KEY_B64'), 'base64').toString('utf8'); }
  private publicKey(): string { return Buffer.from(this.config.getOrThrow<string>('JWT_PUBLIC_KEY_B64'), 'base64').toString('utf8'); }
}
