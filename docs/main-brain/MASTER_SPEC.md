# MASTER SPEC

This file is the canonical product blueprint.

## Section A — Assumptions

1. Timezone: store in UTC (`timestamptz`), render in venue local timezone (default `Asia/Kolkata`).
2. City filtering: lobby/browse uses selected `city_id`; changing city does not alter history.
3. Geo search: nearby within city by venue geo and optional player location; default radius 8 km; fallback to popular areas when location unavailable.
4. Slot granularity: per-vendor template slot length (30/45/60/90), no global slot length.
5. Vendor windows per format: `join_deadline_minutes` (default 180), `checkin_open_minutes` (default 30), `no_show_grace_minutes` (required).
6. Scoring v1: winner mandatory, `score_json` optional.
7. Tournament v1: single elimination only, best-effort schedule in declared windows.
8. Chat: realtime WebSocket + DB persistence/retry + abuse controls.
9. Auth: phone OTP and Google, multi-identity linking to one `user_id`.
10. Legal-safe SaaS only: no payment verification/collection; entry fee/prize are display-only; payment status is vendor-marked operational field.
11. Scale target: 1,000,000 users; read-heavy lobby/leaderboard, write-heavy booking/challenge/chat.
12. Soft delete for auditability on most entities.

## Section B — Product Deconstruction

### Core modules

1. Auth & Identity
2. Tenant/Vendor
3. Venue & Resources
4. Availability
5. Booking
6. Formats
7. Challenges & Teams
8. Match Ops
9. Tournaments
10. Chat
11. Stats/Levels/Leaderboards
12. Reviews
13. Notifications
14. Admin Console
15. Audit & Safety
16. Optional AI Assistant Layer

### Dependency path

`Auth -> Vendor/Users -> Venue/Resources -> Availability -> Booking -> Challenges/Teams -> Match Ops -> Stats/Leaderboards/Reviews`

Tournaments reuse venue/resources + booking + match ops + stats.
Chat attaches to challenge/tournament/vendor support.

### Non-goals enforcement

- No payment routes.
- No wallet/payout tables.
- No earnings UI.
- Lint/copy bans for gambling/payment-holding language.

## Section C — Roles & Permissions

- Player: browse/create/accept/confirm (captain), chat, reviews, register tournaments.
- Vendor owner/staff (scoped by vendor): schedule, formats, blocks, check-ins, dispute resolution (referee/owner), payment status marker, moderation.
- Admin: approvals, overrides, levels config, moderation, audit tools.
- Tenant boundary rule: vendor/staff can only access matching `vendor_id` resources.

## Section D — SaaS-only Legal-safe Rules

### Forbidden patterns

- Wallet/payout/withdraw/deposit/stake/2x style copy.
- Any implication platform holds funds.
- UPI reference or transaction proof storage.
- Outcome-based platform fees tied to winners/losers.

### Allowed patterns

- Entry fee (paid to organizer), prize (paid by organizer).
- Payment required (handled by organizer).
- Operational payment status field: `UNKNOWN | PAID | UNPAID`.

### Audit requirements

- Vendor payment status changes logged.
- Vendor dispute resolutions logged.
- Admin overrides logged with before/after snapshots.

## Section E — System Architecture

- PWA: Next.js + WebSocket client.
- API: NestJS + WebSocket gateway.
- Data: Postgres source of truth.
- Redis: cache/rate-limit/jobs.
- Storage: S3-compatible for media/evidence.
- Worker: BullMQ jobs (hold expiry, snapshots, notifications).

### Environments

- `dev`, `staging`, `prod` with separate Postgres/Redis.
- Feature flags by env and city.

### CI/CD

1. PR checks: lint -> typecheck -> unit -> migration dry-run -> e2e smoke.
2. Staging deploy on merge to `main`.
3. Prod deploy on tagged release + manual approval.
4. DB migrations forward-only with compensating rollback strategy.

## Section F — PWA Blueprint

### UX style

- Gaming-lobby feel with large CTAs (>=52px), rounded cards, neon accents, lightweight motion.

### Routes

Player: `/auth`, `/lobby`, `/book`, `/venues/[venueId]`, `/challenge/[challengeId]`, `/tournaments`, `/tournament/[tournamentId]`, `/leaderboard`, `/inbox`, `/chat/[conversationId]`, `/profile`.
Vendor: `/vendor`, `/vendor/schedule`, `/vendor/formats`, `/vendor/blocks`, `/vendor/tournaments`, `/vendor/inbox`, `/vendor/settings`.
Admin: `/admin`, `/admin/vendors`, `/admin/disputes`, `/admin/levels`, `/admin/moderation`, `/admin/audit`.

### TanStack Query keys

- `lobby:challenges:{city}:{sport}:{timeRange}`
- `venue:{id}`
- `venueAvailability:{venueId}:{date}`
- `challenge:{id}`
- `tournament:{id}`
- `leaderboard:{sport}:{scope}:{window}:{geo}`
- `conversations:{userId}`

### Service worker

- Precache shell/icons/fonts/core UI.
- Runtime cache: venues and rules.
- Never cache auth/admin/private messages.
- Offline: cached lobby and chat previews; queued chat sends when back online.

### Push

- opponent request/confirm prompt/match soon/dispute resolved/fixture posted/chat mention.

### Perf budgets

- Initial critical JS < 200KB target.
- Lighthouse PWA > 90.
- Lazy WebSocket connection only where needed.

## Section G — Database Schema

Common columns for most tables:

- `id uuid pk default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`
- `row_version int not null default 1`

### Core entities

- `users`, `user_identities`, `sessions`
- `vendors`, `vendor_staff`
- `venues`, `resources`
- `formats`
- `availability_templates`, `blocks`
- `bookings` with exclusion constraint
- `challenges`, `teams`, `team_members`
- `matches`, `match_results`, `disputes`
- `tournaments`, `tournament_entries`, `tournament_matches`, `tournament_brackets`
- `sport_stats`, `level_thresholds`, `leaderboard_snapshots`
- `reviews`
- `conversations`, `conversation_participants`, `messages`, `message_reports`
- `notifications`, `audit_logs`, `idempotency_keys`

### Hard booking integrity SQL

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  resource_id WITH =,
  tsrange(start_ts, end_ts) WITH &&
)
WHERE (status IN ('HELD','WAITING_OPPONENT','CONFIRMED','CHECKIN_OPEN','IN_PROGRESS','RESULT_PENDING'));
```

### Retention

- Messages: 12 months default.
- Audit logs: minimum 24 months.
- Soft deletes retained unless admin purge.

## Section H — API Contracts (Expanded)

Global:

- Auth required except OTP request/verify and Google start/callback.
- `Idempotency-Key` required on critical writes.
- Standard errors: 400/401/403/404/409/429/503.

### Auth APIs

- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /auth/google/start`
- `GET /auth/google/callback`

### Player browse APIs

- `GET /lobby/challenges`
- `GET /venues`
- `GET /venues/:id`
- `GET /venues/:id/availability`

### Challenge/team APIs

- `POST /challenges`
- `POST /challenges/:id/accept`
- `POST /challenges/:id/confirm-opponent`
- `POST /teams/:teamId/invite`
- `POST /teams/:teamId/remove`
- `POST /teams/:teamId/join`

### Match ops APIs

- `POST /matches/:id/checkin`
- `POST /matches/:id/submit-result`
- `POST /vendor/matches/:id/resolve-dispute`
- `POST /vendor/matches/:id/mark-payment-status`

### Reviews APIs

- `POST /matches/:id/reviews`

### Tournament APIs

- `POST /vendor/tournaments`
- `POST /tournaments/:id/register`
- `POST /vendor/tournaments/:id/generate-bracket`

### Chat APIs

- `GET /conversations`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`

## Section I — State Machines

### Booking lifecycle

- none -> HELD -> WAITING_OPPONENT -> CONFIRMED -> CHECKIN_OPEN -> IN_PROGRESS -> RESULT_PENDING -> COMPLETED
- cancellation allowed from multiple states by system/vendor on deadlines/no-show/block.

### Challenge lifecycle

- WAITING_OPPONENT -> OPPONENT_REQUESTED -> CONFIRMED -> CLOSED
- auto-cancel if join deadline passes before confirm.

### Dispute lifecycle

- OPEN -> RESOLVED or ESCALATED -> RESOLVED.

### Tournament lifecycle

- DRAFT -> REG_OPEN -> REG_CLOSED -> LIVE -> COMPLETED.

## Section J — Page-by-page Build Plan

Player pages: auth, lobby, book, challenge details with tabs, tournaments, leaderboard, inbox/chat, profile.
Vendor pages: schedule, formats, tournaments, inbox, settings.
Admin pages: vendors, disputes, levels, moderation, audit.

## Section K — Stats/Levels/Leaderboards

- Update only on `SETTLED` or `FORFEIT`.
- Winner: wins+matches, streak++.
- Loser: losses+matches, streak reset.
- Level derived from thresholds by wins.
- Snapshot-based top leaderboards for fast reads.

## Section L — Tournament v1

- Deterministic seeding using tournament id + bracket version.
- Power-of-two bracket with byes.
- Conflict-proof scheduling via booking constraint.
- Unscheduled matches surfaced for manual scheduling.

## Section M — Security & Abuse Prevention

- Refresh rotation + device binding + OAuth CSRF checks.
- Central policy engine `can(actor, action, resource)`.
- Exact rate limits for OTP/challenges/messages/reports.
- Chat safety: reporting, moderation delete, block user, attachment limits.
- Signed upload URLs with allowlist.
- Privacy readiness: deletion workflow + minimal collection.

## Section N — Observability & Reliability

### Core metrics

- `booking_conflict_total`
- `challenge_created_total`, `challenge_accepted_total`, `challenge_confirmed_total`
- `match_disputes_total`, `match_settled_total`
- `chat_messages_total`, `chat_reports_total`
- endpoint p95 latency metrics
- websocket connected users

### Alerts

- conflict spikes, dispute anomalies, elevated 5xx, high DB CPU.

### SLOs

- Lobby p95 < 300ms
- Availability p95 < 500ms
- Create challenge p95 < 600ms
- WS send ack p95 < 200ms

### DR

- daily backups, weekly restore test, city kill-switch runbook.

## Section O — Sprint-by-sprint Implementation

- Sprint 0: foundation
- Sprint 1: google + profile
- Sprint 2: vendor/admin + venue/resources
- Sprint 3: availability + blocks
- Sprint 4: booking integrity + load tests
- Sprint 5: formats + create challenge + lobby
- Sprint 6: accept/confirm + teams + challenge chat
- Sprint 7: match day ops + payment status + vendor chat
- Sprint 8: results + disputes + moderation
- Sprint 9: stats + levels + leaderboards + reviews
- Sprint 10: tournaments v1 + tournament chat
- Sprint 11: hardening + scale readiness

## Section P — Scope Cuts (if needed)

1. Chat attachments
2. Random fill teams
3. Tournament auto-scheduling
4. Review text
5. Push notifications

Must-not-cut: vendor approval, slot integrity constraint, challenge flow, dispute flow, audit logs.

## Section Q — Glossary

- Vendor: venue operator
- Venue: physical location
- Resource: individual court/ground
- Format: template for team size/duration/rules/windows
- Booking: reserved resource time range
- Challenge: opponent-seeking booking
- Match: confirmed play instance
- Dispute: result mismatch needing resolution
- Tournament: bracketed event
- Payment status: operational marker only
- Conversation: chat thread per challenge/tournament/support

## AI Agent Layer (Optional)

### Use-cases

- Slot suggestions
- Draft tournament rules/format text
- Summarize disputes
- Draft vendor support replies

### Guardrails

- No irreversible action without explicit human confirmation
- Role-based tool access
- Full logging with redaction

### Optional tables

- `ai_run(id, actor_id, actor_role, input_redacted, output, tools_used, created_at)`
- `ai_tool_log(id, ai_run_id, tool_name, request_json, response_json, latency_ms)`

### Prompt injection defenses

- System prompt + tool whitelist
- Never treat user chat content as tool-permission instructions
- sanitize/escape links and embedded prompt-like content before tool calls
