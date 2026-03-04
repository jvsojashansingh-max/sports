import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const method = request.method || 'UNKNOWN';
        const route = resolveRouteLabel(request);
        const status = String(response.statusCode ?? 0);

        this.metrics.incrementCounter('http_requests_total', 1, {
          method,
          route,
          status,
        });
        this.metrics.observeLatency('http_request_latency_ms', durationMs, {
          method,
          route,
        });

        if ((response.statusCode ?? 0) >= 500) {
          this.metrics.incrementCounter('http_5xx_total', 1, {
            method,
            route,
          });
        }
      }),
    );
  }
}

function resolveRouteLabel(request: Request): string {
  const routePath = request.route?.path;
  const baseUrl = request.baseUrl || '';
  if (typeof routePath === 'string') {
    return `${baseUrl}${routePath}` || '/';
  }
  if (Array.isArray(routePath)) {
    return `${baseUrl}${routePath.join('|')}` || '/';
  }
  return request.path || request.url || '/';
}
