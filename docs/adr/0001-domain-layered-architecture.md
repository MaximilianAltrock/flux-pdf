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
- Layer names are standardized as: `ui`, `store`, `application`, `domain`, `infrastructure`
- Application layer may use Vue reactivity/composables for orchestration; domain remains framework-free.
- Per-domain required/optional/deferred layers are defined in `docs/refactor/domain-layer-matrix.json` (single source of truth)
- Legacy paths (`src/stores/*`, `src/services/*`, `src/commands/*`) are removed and blocked by architecture validation

## Consequences

### Positive

- Feature code locality improves.
- Domain/application logic becomes easier to test without Vue rendering.
- Infrastructure dependencies are isolated behind domain/application APIs.
- Incremental migration is possible without breaking existing imports.

### Tradeoffs

- Additional lint/config rules to maintain boundaries.
- Contributors need to learn and follow layer boundaries.

## Guardrails

- ESLint boundary rules are active in `eslint.config.ts` for `src/domains/**`.
- Domain layer matrix is enforced by `scripts/validate-domain-layer-matrix.mjs` (via `npm run validate:architecture`).
- Core document workflows are guarded by `scripts/validate-core-usecase-boundaries.mjs` to prevent runtime bypass of application use-cases.
- History commands are data-only payloads; execution/undo is centralized in `src/domains/history/application/command-executor.ts`.
- PR checklist enforces typed APIs, no side effects in computed, props-down/events-up, and behavior tests for changes.

## Migration Notes

- New work must be added to `src/domains/*` by default.
- Legacy folders must not be reintroduced.
