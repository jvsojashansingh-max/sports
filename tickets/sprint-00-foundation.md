# Sprint 00 — Foundation

## Objectives

- Monorepo scaffold + CI foundations
- Auth OTP/session baseline
- RBAC/policy engine scaffold
- Audit logging scaffold
- Next.js PWA shell + NestJS API + Worker skeleton

## Tickets

### S0-001 (5) Monorepo + Tooling
- Scope: `apps/*`, `packages/*`, root workspace scripts, base configs
- Acceptance: local workspace scripts available for dev/lint/typecheck/test

### S0-002 (5) Prisma baseline
- Scope: foundational schema for users, identities, sessions, audit, idempotency
- Acceptance: schema present and migration-ready

### S0-003 (8) OTP/session auth baseline
- Scope: request/verify otp endpoints (stub), refresh rotation model, logout revoke path
- Acceptance: protected route flow can be wired to auth guard

### S0-004 (5) RBAC/policy scaffold
- Scope: `can(actor, action, resource)` service + guards
- Acceptance: forbidden actions return 403 with typed error

### S0-005 (3) Audit scaffolding
- Scope: append-only action logs for critical mutations
- Acceptance: action writes audit record with actor + object + before/after

## Demo

- API health route responds
- Web app route loads
- Documentation + ticketing structure complete
