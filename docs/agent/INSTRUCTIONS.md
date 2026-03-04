# Agent Operating Instructions

## Execution order

1. Read `docs/main-brain/NON_NEGOTIABLES.md`
2. Read `docs/main-brain/PHASE_PLAN.md`
3. Read only required sections in `docs/main-brain/MASTER_SPEC.md`
4. Execute tickets for current sprint only unless explicitly asked.

## Restrictions

- Do not implement payment acceptance/verification logic.
- Do not add wallet/payout/balance concepts.
- Do not break tenant boundaries.
- Do not bypass booking overlap DB constraints.

## Required implementation discipline

- Guard state transitions in a central state module.
- Add tests for each new state transition or policy.
- Log critical actor actions to audit logs.
- Keep writes idempotent for critical endpoints.

## Completion checklist per ticket

- Scope implemented
- Unit/integration tests added
- API contract updated
- Audit/security notes updated
- Demo steps written
