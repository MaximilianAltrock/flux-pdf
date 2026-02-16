# ADR-0001: Domain-First Layered Frontend Architecture

- Status: Accepted
- Date: 2026-02-16
- Owners: Flux PDF contributors

## Context

The editor has long-lived state, command history, and high interaction density. Prior flat folders mixed UI, state, and infrastructure concerns, making feature changes and testing harder.

## Decision

Adopt and enforce a layered domain-first structure:

- Dependency direction: `ui -> application -> domain -> infrastructure`
- Domain modules under `src/domains/{workspace,document,editor,history,export}`
- Each domain uses subfolders: `ui`, `store`, `application`, `domain`, `infrastructure`
- Legacy paths (`src/stores/*`, `src/services/*`, `src/commands/*`) remain as temporary compatibility wrappers during migration

## Consequences

### Positive

- Feature code locality improves.
- Domain/application logic becomes easier to test without Vue rendering.
- Infrastructure dependencies are isolated behind domain/application APIs.
- Incremental migration is possible without breaking existing imports.

### Tradeoffs

- Short-term duplication (legacy wrappers + domain modules).
- Additional lint/config rules to maintain boundaries.
- Contributors need to learn and follow layer boundaries.

## Guardrails

- ESLint boundary rules are active in `eslint.config.ts` for `src/domains/**`.
- PR checklist enforces typed APIs, no side effects in computed, props-down/events-up, and behavior tests for changes.

## Migration Notes

- New work must be added to `src/domains/*` by default.
- Legacy folders are compatibility-only and should be reduced over time.
