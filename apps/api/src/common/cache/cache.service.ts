import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.redis = null;
      return;
    }

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as T;
      } catch {
        // Fall back to memory cache when Redis is unavailable.
      }
    }

    const fromMemory = this.memory.get(key);
    if (!fromMemory) {
      return null;
    }
    if (fromMemory.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(fromMemory.value) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);

    if (this.redis) {
      try {
        await this.redis.set(key, payload, 'EX', ttlSeconds);
      } catch {
        // Keep memory cache in sync as a safety fallback.
      }
    }

    this.memory.set(key, {
      value: payload,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    if (this.redis) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', '100');
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch {
        // Ignore Redis scan/delete failures and continue with memory cache cleanup.
      }
    }

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
