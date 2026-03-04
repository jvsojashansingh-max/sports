# Sprint 11 Security Hardening Checklist

## Implemented controls

- API bootstrap hardening:
  - JSON/urlencoded body limit `1mb`
  - CORS origin allowlist via `CORS_ORIGIN`
  - security headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: no-referrer`
    - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
    - `Cross-Origin-Resource-Policy: same-origin`
    - `Strict-Transport-Security` in production
- Multipart payload rejection in API (`415`) until signed-upload flow is enabled.
- Rate-limit guardrails:
  - OTP request: `5/min per phone`, `20/min per IP`
  - Challenge create: `10/min per user`
  - Challenge accept: `20/min per user`
  - Message report: `5/min per user`
  - Existing chat send limits retained:
    - `10 messages / 10 sec / user`
    - `60/min per conversation` (`40/min` for tournament chat)

## Verification steps

1. OTP abuse simulation:
   - send >5 OTP requests for same phone within 1 minute -> expect `429 RATE_LIMITED`.
2. Challenge create flood:
   - >10 requests from same player within 1 minute -> expect `429`.
3. Challenge accept flood:
   - >20 accepts from same player within 1 minute -> expect `429`.
4. Message report flood:
   - >5 reports from same user within 1 minute -> expect `429`.
5. Multipart rejection:
   - send `multipart/form-data` to API route -> expect `415`.

## Operational notes

- In-memory limits reset on API restart; for multi-instance production, migrate these counters to Redis-backed sliding windows.
- Keep hardening non-destructive:
  - no payment verification flows
  - no wallet or payout data paths
