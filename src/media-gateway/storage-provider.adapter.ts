import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

@Injectable()
export class StorageProviderAdapter {
  private readonly allowedHosts: Set<string>;
  constructor(private readonly config: ConfigService) { this.allowedHosts = new Set(config.getOrThrow<string>('MEDIA_PROVIDER_ALLOWED_HOSTS').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)); }

  async fetch(url: string, range?: string): Promise<globalThis.Response> {
    const parsed = this.validateUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.getOrThrow<number>('MEDIA_PROVIDER_TIMEOUT_MS'));
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac('sha256', this.config.getOrThrow<string>('MEDIA_PROVIDER_ORIGIN_SECRET')).update(`${timestamp}\n${parsed.pathname}${parsed.search}`).digest('hex');
      const headers: Record<string, string> = { 'x-urdubolo-origin-timestamp': timestamp, 'x-urdubolo-origin-signature': signature };
      if (range) headers.range = range;
      const response = await fetch(parsed.toString(), { method: 'GET', redirect: 'error', signal: controller.signal, headers });
      if (!response.ok && response.status !== 206) throw new ServiceUnavailableException('Media provider request failed');
      return response;
    } catch (error) { if (error instanceof ServiceUnavailableException) throw error; throw new ServiceUnavailableException('Media provider is unavailable'); }
    finally { clearTimeout(timeout); }
  }

  validateUrl(value: string): URL {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new ServiceUnavailableException('Media provider URL is invalid'); }
    if (parsed.protocol !== 'https:' || !this.allowedHosts.has(parsed.hostname.toLowerCase())) throw new ServiceUnavailableException('Media provider is not allowed');
    return parsed;
  }
}
