# Sprint 10 — Tournaments v1 (Single Elimination)

## Objectives

- Tournament create/register/bracket/schedule
- Tournament chat

## Tickets

### S10-001 (13) Tournament create + register
- Vendor create and player registration flows

### S10-002 (13) Bracket generation + fixture scheduling
- Deterministic bracket versioning and conflict-proof scheduling

### S10-003 (8) Tournament chat + match list
- Group conversation and result flow reuse

## Acceptance

- End-to-end single elimination event can run

## Status (2026-03-04)

- Implemented baseline:
  - Prisma schema + migration for tournaments, entries, matches, brackets
  - RBAC policy actions for tournament create/register/view/generate
  - API endpoints:
    - `GET /tournaments`
    - `GET /tournaments/:id`
    - `POST /vendor/tournaments`
    - `POST /tournaments/:id/register`
    - `POST /vendor/tournaments/:id/generate-bracket`
  - Deterministic single-elim bracket tree generation across all rounds
  - Best-effort conflict-proof scheduling with booking constraints (round-1 auto-scheduling baseline)
  - Tournament chat moderator enrollment:
    - vendor owner + acting vendor user added as moderators
  - Web UI baselines:
    - `/tournaments` list + register action
    - `/tournament/[tournamentId]` overview/matches/bracket/chat tabs baseline
    - `/vendor/tournaments` create + generate bracket baseline
  - DB integration tests:
    - tournament create/register participant wiring
    - bracket generation + booking creation
    - tournament result submission through shared matches engine
    - both auto-skip when Postgres runtime is not reachable
- Sprint closure status:
  - Tournament results lifecycle wired through shared match/dispute paths
  - Winner progression into subsequent rounds wired from match settlement/forfeit outcomes
  - Tournament chat lifecycle hardened for moderation scope and rate limits
  - Remaining DB-runtime validation: execute in staging/local with reachable Postgres to remove integration-test skips
