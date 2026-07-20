import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClientType;
  private connectPromise: Promise<unknown> | null = null;

  constructor(config: ConfigService) {
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      socket: { connectTimeout: 5000 },
    }) as RedisClientType;
    this.client.on('error', (error) => {
      process.stderr.write(JSON.stringify({ level: 'error', event: 'redis_error', message: error.message }) + '\n');
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isOpen || this.client.isReady) return;
    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    if (!this.client.isReady) throw new ServiceUnavailableException('Redis is unavailable');
    return this.client.ping();
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    await this.ensureConnected();
    if (!this.client.isReady) throw new ServiceUnavailableException('Rate-limit service is unavailable');
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);
    return count;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    if (!this.client.isReady) throw new ServiceUnavailableException('Redis is unavailable');
    await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    if (!this.client.isReady) throw new ServiceUnavailableException('Redis is unavailable');
    const value = await this.client.get(key);
    return value ? JSON.parse(value) as T : null;
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    if (!this.client.isReady) throw new ServiceUnavailableException('Redis is unavailable');
    await this.client.del(key);
  }
}
