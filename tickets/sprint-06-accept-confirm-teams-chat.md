# Sprint 06 — Accept/Confirm + Teams + Challenge Chat

## Objectives

- Race-safe challenge acceptance
- Team management and challenge chat

## Tickets

### S6-001 (13) Accept + captain confirm
- Row-lock accept and strict state transitions

### S6-002 (8) Team management
- Invite/remove/join with max team size and eligibility checks

### S6-003 (13) Challenge chat MVP
- Conversations/messages + websocket push + rate limits

## Acceptance

- Create -> accept -> confirm -> group chat flow works end-to-end

## Status (2026-03-04)

- Implemented:
  - `POST /challenges/:id/accept` with DB row lock (`FOR UPDATE`)
  - `POST /challenges/:id/confirm-opponent` creating `matches` + `conversations`
  - Team member APIs: invite/remove/join with team-size and eligibility checks
  - Chat REST APIs: list conversations, list messages, send message
  - WebSocket chat gateway: auth, conversation room join/leave, real-time `chat.message_created` push
  - Web client socket wiring for inbox/chat live updates
  - DB-backed integration tests added for accept-race and confirm-opponent flow
- UI baseline: challenge detail actions + inbox + chat screens
- Remaining for full sprint closure:
  - Execute DB-backed integration tests against a reachable Postgres runtime (currently auto-skipped when DB unavailable)
