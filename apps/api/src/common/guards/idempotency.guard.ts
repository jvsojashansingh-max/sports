import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_IDEMPOTENCY_KEY } from '../decorators/require-idempotency.decorator';
import { IdempotencyService } from '../idempotency/idempotency.service';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
      return true;
    }

    const idempotencyKeyHeader = req.headers['idempotency-key'];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' ? idempotencyKeyHeader.trim() : undefined;

    if (!idempotencyKey) {
      throw new BadRequestException('VALIDATION_ERROR: Idempotency-Key required');
    }

    const ttlMs = 10 * 60 * 1000;
    const userId = req.user?.id;
    const signature = `${method}:${req.path}:${JSON.stringify(req.body ?? {})}`;

    if (userId && isUuid(userId)) {
      let reserved = false;
      try {
        reserved = await this.idempotencyService.reservePersistent({
          userId,
          endpoint: req.path,
          key: idempotencyKey,
          requestSignature: signature,
          ttlMs,
        });
      } catch {
        const fallbackKey = `${userId}:${req.path}:${idempotencyKey}:fallback`;
        reserved = this.idempotencyService.reserve(fallbackKey, ttlMs);
      }
      if (!reserved) {
        throw new ConflictException('CONFLICT: duplicate idempotent request');
      }
      return true;
    }

    const compositeKey = `${userId ?? 'anonymous'}:${req.path}:${idempotencyKey}`;
    if (!this.idempotencyService.reserve(compositeKey, ttlMs)) {
      throw new ConflictException('CONFLICT: duplicate idempotent request');
    }

    return true;
  }
}

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}
