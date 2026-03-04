# Main Brain Index

This folder is the single source of truth for product, architecture, legal-safe guardrails, and phased execution.

## Files

- `MASTER_SPEC.md`: complete product blueprint (assumptions, modules, roles, architecture, schema, API, workflows, security, roadmap).
- `NON_NEGOTIABLES.md`: hard guardrails, legal-safe SaaS boundaries, copy bans, tenant isolation, and invariants.
- `PHASE_PLAN.md`: sprint-by-sprint execution plan with must-ship core and scope cuts.
- `AGENT_READY_BACKLOG.md`: execution-oriented module/test/file map for coding agents.
- `STATUS.md`: live progress tracker updated as implementation advances.

## Agent rule

Before writing feature code, read in order:
1. `NON_NEGOTIABLES.md`
2. `PHASE_PLAN.md`
3. relevant section in `MASTER_SPEC.md`

If implementation and docs conflict, docs win unless user explicitly overrides.
