# Sprint 07 — Match Ops + Payment Status Marker + Vendor Chat

## Objectives

- Vendor check-in/no-show operations
- Ops-only payment status marker
- Vendor support chat

## Tickets

### S7-001 (8) Check-in + no-show logic
- Presence capture and forfeits by vendor decision window

### S7-002 (3) Payment status marker
- `UNKNOWN/PAID/UNPAID` only; audit logs mandatory

### S7-003 (8) Vendor support chat
- Player/vendor support conversations with moderation controls

## Acceptance

- Vendor can run match-day operations without payment handling logic

## Status (2026-03-04)

- Implemented:
  - `POST /vendor/matches/:id/checkin` (presence capture with `match_checkins`, status progression to `CHECKIN_OPEN`/`IN_PROGRESS`)
  - `POST /vendor/matches/:id/forfeit` (vendor no-show decision path)
  - `POST /vendor/matches/:id/mark-payment-status` (ops-only marker with audit)
  - `POST /venues/:venueId/support-conversation` (player opens support chat with vendor owner participant)
  - Vendor/player inbox + chat route baseline uses shared conversation endpoints
- Remaining for full sprint closure:
  - None in baseline scope; phase closed in code (pending DB migration apply in a reachable Postgres runtime)
