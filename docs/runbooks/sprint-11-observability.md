# Sprint 11 Observability Runbook

## What is instrumented

- HTTP counters/latency histogram for every API route:
  - `http_requests_total{method,route,status}`
  - `http_request_latency_ms{method,route}`
  - `http_5xx_total{method,route}`
- Product counters:
  - `booking_conflict_total`
  - `challenge_created_total`
  - `challenge_accepted_total`
  - `challenge_confirmed_total`
  - `match_disputes_total`
  - `match_settled_total{mode,reason}`
  - `chat_messages_total{conversationType}`
  - `chat_reports_total`
- WebSocket gauge:
  - `websocket_connected_users`

## Endpoints

- JSON snapshot: `GET /api/admin/metrics`
- Prometheus exposition: `GET /api/admin/metrics/prometheus`

Both endpoints require admin authorization (`vendor.approval.review` action).

## SLO checks

- Lobby feed p95: `< 300ms`
- Availability p95: `< 500ms`
- Create challenge p95: `< 600ms`
- WebSocket ack target: `< 200ms` (currently approximated from message send + delivery logs; dedicated ws-ack metric is pending)

## Alert thresholds

- 5xx error rate: `http_5xx_total / http_requests_total > 1%` for 5 minutes
- Booking conflict anomaly spike:
  - baseline ratio check `booking_conflict_total / challenge_created_total`
  - page on sharp deviation vs trailing 7-day average
- Dispute anomaly:
  - `match_disputes_total` by vendor above baseline threshold
- Infra stress:
  - DB CPU > 80% sustained for 5 minutes

## Incident response quick actions

1. Validate metric endpoint is healthy.
2. Filter by `route` to isolate offender endpoints.
3. If city-localized issue, disable affected city via feature flag.
4. If write contention issue, reduce create/accept rate limits temporarily.
5. Keep audit export for postmortem (`/api/admin/audit`).
