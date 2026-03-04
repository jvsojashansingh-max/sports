# Phase Plan (Sprint 0-11)

## Sprint 0 — Foundation

- Monorepo + Docker + CI
- Auth OTP + sessions + RBAC + audit scaffolding
- Next.js PWA shell + design tokens
- NestJS API skeleton + Prisma migrations
- Redis + BullMQ setup

## Sprint 1 — Google Auth + Profiles

- Google OAuth start/callback
- Account linking to existing phone user
- Profile and city switcher
- Vendor application draft

## Sprint 2 — Vendor + Admin Approval + Venues

- Vendor registration and approval lifecycle
- Venue/resource CRUD + photos
- Player browse approved/live venues

## Sprint 3 — Availability + Blocks

- Template editor
- Blocks management
- Availability compute endpoint
- Vendor schedule read view

## Sprint 4 — Booking Integrity

- HELD bookings + expiry worker
- Exclusion constraint + concurrency tests

## Sprint 5 — Formats + Create Challenge + Lobby

- Vendor formats CRUD
- Challenge creation transaction flow
- Lobby feed caching

## Sprint 6 — Accept/Confirm + Teams + Challenge Chat

- Race-safe accept with row locks
- Captain confirm creates match + conversation
- Team invites/random fill
- Challenge group chat MVP

## Sprint 7 — Match Ops + Ops-only Payment Status + Vendor Chat

- Check-ins and no-show handling
- Vendor payment status marker with audit
- Vendor support chat

## Sprint 8 — Results + Disputes + Moderation

- Captains submit result
- Auto dispute on mismatch
- Referee/admin resolution
- Message report flow

## Sprint 9 — Stats + Levels + Leaderboards + Reviews

- Stats updates on settlement only
- Level thresholds config
- Leaderboard snapshots
- Venue/player reviews

## Sprint 10 — Tournaments v1

- Single elimination tournament create/register
- Deterministic bracket generation
- Conflict-proof fixture scheduling
- Tournament chat

## Sprint 11 — Hardening + Scale

- WAF and tighter rate limits
- Observability dashboards and alerts
- Perf/query/index tuning
- DR restore drill

## Scope cuts if needed

1. Chat attachments
2. Random-fill teams
3. Tournament auto-scheduling
4. Review text
5. Push notifications
