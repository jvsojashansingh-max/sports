# Sprint 08 — Results + Disputes + Moderation

## Objectives

- Match result submission + dispute resolution
- Chat reporting and moderation queue

## Tickets

### S8-001 (8) Result submit + auto-dispute
- Captain mismatch opens dispute

### S8-002 (8) Resolve dispute
- Vendor referee resolution + admin escalation path

### S8-003 (5) Message reports
- Report queue and moderation actions

## Acceptance

- Disputed results become resolvable with audit trail

## Status (2026-03-04)

- Implemented baseline:
  - `POST /matches/:id/submit-result` (captain result submission)
  - Auto-state transition:
    - matching submissions -> `SETTLED`
    - mismatch -> `DISPUTED` + `disputes` row upsert
  - `POST /vendor/matches/:id/resolve-dispute`
  - `GET /admin/disputes`, `POST /admin/disputes/:id/resolve`, `POST /admin/disputes/:id/escalate`
  - Message reports:
    - `POST /messages/:id/report`
    - `GET /admin/message-reports`
    - `POST /admin/message-reports/:id/review`
  - Admin disputes + moderation UI baselines wired in web app
- Remaining for full sprint closure:
  - Add DB-backed integration tests for submit-result/dispute lifecycle once Postgres runtime is available
