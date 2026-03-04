import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type CacheEntry = {
  expiresAt: number;
};

@Injectable()
export class IdempotencyService {
  private readonly memory = new Map<string, CacheEntry>();
  constructor(private readonly prisma: PrismaService) {}

  get(key: string): true | null {
    const current = this.memory.get(key);
    if (!current) {
      return null;
    }

    if (Date.now() > current.expiresAt) {
      this.memory.delete(key);
      return null;
    }

    return true;
  }

  set(key: string, ttlMs: number): void {
    this.memory.set(key, {
      expiresAt: Date.now() + ttlMs,
    });
  }

  reserve(key: string, ttlMs: number): boolean {
    if (this.get(key)) {
      return false;
    }
    this.set(key, ttlMs);
    return true;
  }

  async reservePersistent(params: {
    userId: string;
    endpoint: string;
    key: string;
    requestSignature: string;
    ttlMs: number;
  }): Promise<boolean> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        userId_endpoint_key: {
          userId: params.userId,
          endpoint: params.endpoint,
          key: params.key,
        },
      },
    });

    if (existing && existing.expiresAt > new Date()) {
      return false;
    }

    await this.prisma.idempotencyKey.upsert({
      where: {
        userId_endpoint_key: {
          userId: params.userId,
          endpoint: params.endpoint,
          key: params.key,
        },
      },
      create: {
        userId: params.userId,
        endpoint: params.endpoint,
        key: params.key,
        requestHash: hashRequest(params.requestSignature),
        expiresAt: new Date(Date.now() + params.ttlMs),
      },
      update: {
        requestHash: hashRequest(params.requestSignature),
        expiresAt: new Date(Date.now() + params.ttlMs),
      },
    });

    return true;
  }
}

function hashRequest(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
