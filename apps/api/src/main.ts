import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const listenPort = Number.isFinite(port) ? port : 4000;

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: resolveCorsOrigins(process.env.CORS_ORIGIN),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-device-id'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentType = String(req.headers['content-type'] ?? '');
    if (contentType.includes('multipart/form-data')) {
      res.status(415).json({
        statusCode: 415,
        message: 'UNSUPPORTED_MEDIA_TYPE',
      });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(listenPort);
}

bootstrap();

function resolveCorsOrigins(
  value: string | undefined,
):
  | true
  | ((origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void) {
  if (!value || value.trim().length === 0) {
    return true;
  }
  const exactOrigins = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const vercelProjectPrefixes = exactOrigins
    .map(extractVercelProjectPrefix)
    .filter((item): item is string => item !== null);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (exactOrigins.includes(origin) || matchesVercelDeploymentOrigin(origin, vercelProjectPrefixes)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };
}

function extractVercelProjectPrefix(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) {
      return null;
    }
    return `${url.hostname.slice(0, -'.vercel.app'.length)}-`;
  } catch {
    return null;
  }
}

function matchesVercelDeploymentOrigin(origin: string, allowedPrefixes: string[]): boolean {
  if (allowedPrefixes.length === 0) {
    return false;
  }

  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) {
      return false;
    }

    const hostnamePrefix = url.hostname.slice(0, -'.vercel.app'.length);
    return allowedPrefixes.some((allowedPrefix) => hostnamePrefix.startsWith(allowedPrefix));
  } catch {
    return false;
  }
}
