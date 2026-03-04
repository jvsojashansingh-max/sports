# Sprint 04 — Booking Integrity + Holds

## Objectives

- Enforce no overlap with DB exclusion constraint
- Add hold expiry worker

## Tickets

### S4-001 (8) Booking overlap constraint
- GiST exclusion for active booking states
- Concurrency test for same slot race

### S4-002 (5) Hold TTL worker
- Expire stale HELD bookings automatically

## Acceptance

- Double booking impossible under concurrent attempts
