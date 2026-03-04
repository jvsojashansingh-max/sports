# Agent-Ready Backlog and File Map

## Monorepo plan

- `apps/web` Next.js PWA
- `apps/api` NestJS API + WS gateway
- `apps/worker` BullMQ jobs
- `packages/shared` schemas/enums/policies
- `packages/ui` reusable components
- `packages/testkit` fixtures/factories
- `tickets/sprint-*.md` phased execution

## Required test tracks

1. Unit: state machines and policy logic
2. Integration: API + DB transactions and idempotency
3. E2E: critical user journeys (create/accept/confirm, vendor ops, disputes)
4. Concurrency: booking overlap and accept race conditions

## Must-have concurrency tests

- `apps/api/test/concurrency/bookingOverlap.spec.ts`
- `apps/api/test/concurrency/acceptRace.spec.ts`

## API module shape rule

Each module should contain:

- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.repo.ts`
- `*.policy.ts`
- `*.state.ts`
- `*.dto.ts`
- `__tests__/*`

## State transition rule

No direct status mutation outside dedicated `*.state.ts` transition functions.

## Current implementation status

- Sprint 0 scaffold generated.
- Sprint 1+ feature implementation pending.
