# Sprint 09 — Stats + Levels + Leaderboards + Reviews

## Objectives

- Settlement-based stats updates
- Snapshot leaderboards and reviews

## Tickets

### S9-001 (8) sport_stats + level thresholds
- Update only on `SETTLED/FORFEIT`

### S9-002 (8) Leaderboard snapshots
- Hourly/periodic snapshot jobs and fast read endpoints

### S9-003 (8) Reviews module
- Venue/player reviews post-settlement with uniqueness checks

## Acceptance

- Levels/leaderboards reflect settled outcomes only

## Status (2026-03-04)

- Implemented baseline:
  - Settlement hook updates stats for winner/loser captains with level recalculation from thresholds
  - Admin level threshold APIs:
    - `GET /admin/level-thresholds`
    - `POST /admin/level-thresholds`
  - Leaderboard read API:
    - `GET /leaderboards` (snapshot-first fallback to live stats)
  - Reviews API:
    - `POST /matches/:id/reviews`
  - Leaderboard snapshot worker jobs:
    - hourly + daily snapshot writers in worker
  - Web UI baselines:
    - `/leaderboard`
    - `/admin/levels`
- Remaining for full sprint closure:
  - DB-backed integration tests for settlement->stats consistency once Postgres runtime is reachable
