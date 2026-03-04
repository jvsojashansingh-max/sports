# Non-Negotiables

## Product invariants

- No payment collection, wallet, payout, withdrawal, deposit, stake, betting, or winnings logic.
- Platform stores only operational payment marker set by vendor: `UNKNOWN | PAID | UNPAID`.
- Vendor/staff access must be strictly tenant-scoped by `vendor_id`.
- Booking overlap must be impossible for active states through DB constraint.
- Core challenge flow and disputes must be auditable.
- Critical writes require idempotency key.

## Legal-safe copy policy

## Forbidden words in UI/API copy

- wallet
- payout
- withdraw
- deposit
- stake
- bet
- winnings
- 2x

## Allowed copy

- Entry fee (paid to organizer)
- Prize (paid by organizer)
- Payment required (handled by organizer)

## Hard technical rules

- All times in DB are `timestamptz` in UTC.
- Display timezone defaults to venue timezone; default region `Asia/Kolkata`.
- Soft delete (`deleted_at`) for auditable entities.
- Append-only audit logs for vendor payment marks, dispute resolutions, admin overrides.
- State transitions must be validated against defined state machines.
- Auth security: refresh rotation, device binding, CSRF checks for OAuth.

## Must-never-cut scope

- vendor approval flow
- booking integrity exclusion constraint
- challenge create/accept/confirm lifecycle
- match result verification + dispute handling
- audit logs
