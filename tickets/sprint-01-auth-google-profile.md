# Sprint 01 — Google Login + Profiles

## Objectives

- Add Google OAuth and account linking
- Build profile page and city switcher

## Tickets

### S1-001 (8) Google OAuth + linking
- Endpoints: `/auth/google/start`, `/auth/google/callback`, link flow
- Security: CSRF state + strict redirect validation

### S1-002 (5) Profile + city switch
- Endpoints: `GET /me`, `PATCH /me`
- UI: `/profile`

## Acceptance

- Phone and Google identities can map to one user
- Changing city updates browse/lobby scope
