# Sports App Monorepo

Phase-driven build for a legal-safe sports challenge and tournament platform.

## Main Brain

Read these first:

1. `docs/main-brain/NON_NEGOTIABLES.md`
2. `docs/main-brain/PHASE_PLAN.md`
3. `docs/main-brain/MASTER_SPEC.md`

## Deployment runbooks

1. `docs/runbooks/free-tier-deploy.md` (Vercel + Render + Neon + Upstash)
2. `docs/runbooks/oracle-vm-deploy.md` (Vercel + Oracle VM + Neon + Upstash)

## Workspace

- `apps/web`: Next.js PWA
- `apps/api`: NestJS API + WebSocket
- `apps/worker`: BullMQ workers
- `packages/shared`: shared enums/schemas/policies
- `tickets/*`: sprint execution files

## Sprint status

Current implementation target: `Sprint 0`.

## Local run

1. `pnpm install`
2. `pnpm db:up`
3. `pnpm db:generate`
4. `pnpm db:migrate:deploy`
5. `pnpm dev`

API base URL is `http://localhost:4000/api`, web is `http://localhost:3000`.

## Core invariants

- No payment processing, wallet, payout, or transaction verification logic.
- Booking overlap prevention at DB layer is mandatory.
- Tenant boundary and audit logging are mandatory.
