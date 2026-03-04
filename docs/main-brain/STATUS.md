# Implementation Status

## Current phase

- Active sprint: `Sprint 11 — Hardening + Scale` (baseline implementation completed)

## Progress checklist

- [x] Main brain docs scaffolded
- [x] Sprint ticket files created
- [x] Monorepo scaffolded
- [x] Sprint 0 auth/rbac/audit implemented with DB-backed scaffolding
- [x] Local verification run
- [x] Sprint 1 initial Google start/callback + link endpoint scaffolded
- [x] Profile `PATCH /me` persistence endpoint scaffolded
- [x] Sprint 2 initial vendor register + admin approve/reject endpoints scaffolded
- [x] Sprint 2 venue/resource CRUD endpoints scaffolded
- [x] Sprint 2 player venue browse gated to approved vendors + live venues
- [x] Sprint 2 flow test added (`register -> approve -> live venue visibility`)
- [x] Sprint 3 availability templates CRUD endpoints scaffolded
- [x] Sprint 3 blocks create/list/delete endpoints scaffolded
- [x] Sprint 3 venue availability compute endpoint added (`GET /venues/:id/availability`)
- [x] Sprint 3 vendor schedule UI wired to templates and blocks APIs
- [x] Sprint 3 slot generation tests added
- [x] Sprint 4 bookings model + overlap exclusion constraint migration scaffolded
- [x] Sprint 4 booking hold APIs + hold expiry worker scaffolded
- [x] Sprint 5 formats model + vendor formats APIs scaffolded
- [x] Sprint 5 challenge create transaction endpoint scaffolded (`POST /challenges`)
- [x] Sprint 5 lobby feed endpoint scaffolded (`GET /lobby/challenges`)
- [x] Sprint 5 lobby/vendor-format/player-create-challenge UI baseline wired
- [x] Sprint 5 lobby cache moved to Redis-backed cache service (with in-memory fallback)
- [x] Sprint 5 slot-boundary validation enforced in challenge creation
- [x] Sprint 6 schema primitives added (`team_members`, `matches`, `conversations`, `messages`)
- [x] Sprint 6 challenge APIs added (`GET /challenges/:id`, `POST /challenges/:id/accept`, `POST /challenges/:id/confirm-opponent`)
- [x] Sprint 6 team management APIs added (`/teams/:teamId/invite|remove|join`)
- [x] Sprint 6 chat REST APIs added (`GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`)
- [x] Sprint 6 player UI baseline added for challenge, inbox, and chat routes
- [x] Sprint 6 WebSocket chat delivery added (conversation join + message push + user-room fallback)
- [x] Sprint 6 DB-backed integration tests added for accept race and confirm flow (auto-skip when DB unavailable)
- [x] Sprint 7 schema primitive added (`match_checkins`)
- [x] Sprint 7 vendor match-day APIs added (`/vendor/matches/:id/checkin`, `/forfeit`, `/mark-payment-status`)
- [x] Sprint 7 venue support conversation API added (`POST /venues/:venueId/support-conversation`)
- [x] Sprint 7 vendor/player UI baseline wired for support inbox and match-day controls
- [x] Sprint 7 vendor moderation controls added (mute participant + mod delete message with audit)
- [x] Sprint 8 schema primitives added (`match_results`, `disputes`, `message_reports`)
- [x] Sprint 8 result/dispute APIs added (`submit-result`, vendor resolve, admin resolve/escalate)
- [x] Sprint 8 message report APIs added (report/list/review)
- [x] Sprint 8 admin disputes/moderation UI baselines wired
- [x] Sprint 9 schema primitives added (`sport_stats`, `level_thresholds`, `leaderboard_snapshots`, `reviews`)
- [x] Sprint 9 stats module baseline added (level threshold admin APIs + leaderboard read API)
- [x] Sprint 9 settlement hook updates added in match resolution flow
- [x] Sprint 9 reviews API added (`POST /matches/:id/reviews`)
- [x] Sprint 9 leaderboard/admin-levels web pages wired
- [x] Sprint 9 leaderboard snapshot writer jobs added in worker (hourly/daily baseline)
- [x] Sprint 10 schema/migration baseline added (`tournaments`, `tournament_entries`, `tournament_matches`, `tournament_brackets`)
- [x] Sprint 10 tournament RBAC actions added (`create/register/generate/view`)
- [x] Sprint 10 tournaments API baseline added (`create/list/get/register/generate-bracket`)
- [x] Sprint 10 tournament web pages baseline wired (`/tournaments`, `/tournament/[id]`, `/vendor/tournaments`)
- [x] Sprint 10 tournament chat moderator auto-enrollment added (vendor owner + acting manager)
- [x] Sprint 10 DB integration tests added for tournament create/register/generate (auto-skip when Postgres unavailable)
- [x] Sprint 10 result/dispute flow reused for tournament-linked matches (submission -> settle/dispute -> resolution)
- [x] Sprint 10 full single-elim bracket tree generation added (all rounds persisted)
- [x] Sprint 10 winner propagation added (settled/forfeit result advances next-round sides)
- [x] Sprint 10 chat hardening updates for tournament conversations (moderation scope + tighter rate limits)
- [x] Sprint 11 observability module added (global HTTP metrics + product counters + websocket gauge)
- [x] Sprint 11 admin metrics endpoints added (`/api/admin/metrics`, `/api/admin/metrics/prometheus`)
- [x] Sprint 11 security hardening applied (OTP/challenge/report rate limits + secure headers + body limits + multipart rejection)
- [x] Sprint 11 load-testing baselines added (k6 scripts for lobby/availability/leaderboards/create challenge)
- [x] Sprint 11 runbooks added (`docs/runbooks/sprint-11-observability.md`, `docs/runbooks/sprint-11-security-hardening.md`)

## Next immediate deliverables

1. Execute staging load test runs and record p95 evidence against SLO targets.
2. Perform query/index tuning from staging traces and document migration changes.
3. Complete real Google OAuth provider exchange (currently stubbed `code` handling).
4. Execute pending migrations in local/staging with valid DB credentials and rerun integration suite without skips.
