# k6 load tests

Scripts:

- `lobby-feed-read.js`
- `availability-read.js`
- `leaderboard-read.js`
- `create-challenge-write.js`

## Prerequisites

1. Install k6: https://k6.io/docs/get-started/installation/
2. Start API and DB services.
3. Provide a valid `ACCESS_TOKEN` from a logged-in player account.

## Common environment variables

- `BASE_URL` default: `http://localhost:4000/api`
- `ACCESS_TOKEN` required

## Read path scripts

`lobby-feed-read.js`

- Required env:
  - `CITY_ID`
  - `SPORT_ID` (example: `BADMINTON`)
  - `FROM_TS` (ISO UTC)
  - `TO_TS` (ISO UTC)

`availability-read.js`

- Required env:
  - `VENUE_ID`
  - `DATE` (`YYYY-MM-DD`)

`leaderboard-read.js`

- Required env:
  - `SPORT_ID`

## Write path script

`create-challenge-write.js`

- Required env:
  - `VENUE_ID`
  - `RESOURCE_ID`
  - `FORMAT_ID`
  - `SPORT_ID`
  - `START_TS` (ISO UTC)

This script treats `200` and `409` as acceptable responses because slot conflict is expected under concurrency.

## Example runs

```bash
BASE_URL=http://localhost:4000/api \
ACCESS_TOKEN=<token> \
CITY_ID=<city_uuid> \
SPORT_ID=BADMINTON \
FROM_TS=2026-03-04T00:00:00.000Z \
TO_TS=2026-03-05T00:00:00.000Z \
k6 run infra/scripts/loadtest/k6/lobby-feed-read.js
```

```bash
BASE_URL=http://localhost:4000/api \
ACCESS_TOKEN=<token> \
VENUE_ID=<venue_uuid> \
RESOURCE_ID=<resource_uuid> \
FORMAT_ID=<format_uuid> \
SPORT_ID=BADMINTON \
START_TS=2026-03-05T09:00:00.000Z \
k6 run infra/scripts/loadtest/k6/create-challenge-write.js
```
