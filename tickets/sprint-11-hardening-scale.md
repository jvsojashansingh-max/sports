# Sprint 11 — Hardening + Scale

## Objectives

- Production reliability, security hardening, and performance tuning

## Tickets

### S11-001 (8) Observability + alerts
- [x] Added in-app observability module:
  - global HTTP request counter/latency interceptor
  - product counters (`booking_conflict_total`, challenge/match/chat totals)
  - websocket connected users gauge
- [x] Added admin metrics endpoints:
  - `GET /api/admin/metrics` (JSON snapshot)
  - `GET /api/admin/metrics/prometheus` (Prometheus exposition)
- [x] Added observability runbook:
  - `docs/runbooks/sprint-11-observability.md`

### S11-002 (8) Load tests + query/index tuning
- [x] Added k6 load scripts:
  - `infra/scripts/loadtest/k6/lobby-feed-read.js`
  - `infra/scripts/loadtest/k6/availability-read.js`
  - `infra/scripts/loadtest/k6/leaderboard-read.js`
  - `infra/scripts/loadtest/k6/create-challenge-write.js`
- [x] Updated usage doc:
  - `infra/scripts/loadtest/k6/README.md`
- [ ] Query/index tuning on production traces is pending staging data replay.

### S11-003 (5) Security hardening
- [x] Added OTP rate limits (`5/min per phone`, `20/min per IP`)
- [x] Added challenge create/accept rate limits (`10/min`, `20/min`)
- [x] Added message report rate limit (`5/min per user`)
- [x] Added secure API defaults in bootstrap:
  - body size limits, CORS allowlist, secure headers, multipart rejection
- [x] Added security hardening runbook:
  - `docs/runbooks/sprint-11-security-hardening.md`

## Acceptance

- [x] Documented runbooks and executable load scripts added.
- [ ] Full staging load/security checklist pass pending environment credentials and staged traffic replay.
