# Free-Tier Deploy Runbook (Vercel + Render + Neon + Upstash)

As of March 4, 2026, this stack is valid for low-cost launch:

1. Web: Next.js on Vercel Hobby.
2. API: NestJS on Render Free web service.
3. Postgres: Neon Free.
4. Redis: Upstash Free.
5. Worker: deferred until paid always-on service is added.

## Region pick (India-first latency)

1. API (Render): Singapore.
2. DB (Neon): Mumbai (`ap-south-1`) when available; otherwise Singapore.

## Environment variables

Use `.env.production.example` as the source of truth.

## Service setup checklist

1. Neon:
   - Create project in Mumbai (`ap-south-1`) if available.
   - Copy pooled `DATABASE_URL` with `sslmode=require`.
2. Upstash Redis:
   - Create Redis database in closest available APAC region.
   - Copy `REDIS_URL` (`rediss://...`).
3. Render API:
   - Create Web Service from repo.
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @sports/api build && pnpm --filter @sports/api exec prisma generate && pnpm --filter @sports/api exec prisma migrate deploy`
   - Start command: `pnpm --filter @sports/api start`
   - Set env vars from `.env.production.example`.
4. Vercel Web:
   - Import repo and set project root to `apps/web`.
   - Add `NEXT_PUBLIC_API_BASE_URL` to the Render API URL.
5. CORS:
   - Set `CORS_ORIGIN` on Render API to the Vercel app origin.

## Launch-mode decisions

1. OTP mode: `stub` for demo launch.
2. Google OAuth vars are placeholders right now (current auth flow is stubbed).
3. Free-tier behavior accepted: cold starts, sleep, and hard quotas.

## Important current limitation

The current codebase does not yet consume:

1. `JWT_REFRESH_SECRET`
2. `GOOGLE_CLIENT_ID`
3. `GOOGLE_CLIENT_SECRET`
4. `GOOGLE_REDIRECT_URI`
5. `OTP_PROVIDER`

This means real Google OAuth and real OTP provider credentials will not be active until auth implementation is upgraded.
