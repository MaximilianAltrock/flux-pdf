# ADR-0001: Domain-First Layered Frontend Architecture

- Status: Accepted
- Date: 2026-02-16
- Owners: Flux PDF contributors

## Context

The editor has long-lived state, command history, and high interaction density. Prior flat folders mixed UI, state, and infrastructure concerns, making feature changes and testing harder.

## Decision

Adopt and enforce a layered domain-first structure:

- Domain modules live under `src/domains/*`.
- Common layer names are `ui`, `application`, `domain`, `infrastructure`, `session`, and `store`.
- Not every domain needs every layer; keep only the layers that materially reduce complexity.
- UI depends on `application`/`domain` APIs, not infrastructure adapters.
- Application may use Vue reactivity/composables for orchestration; domain remains framework-free.
- Legacy root folders such as `src/stores/*`, `src/services/*`, and `src/commands/*` stay retired.

## Consequences

### Positive

- Feature code locality improves.
- Domain/application logic becomes easier to test without Vue rendering.
- Infrastructure dependencies are isolated behind domain/application APIs.
- Incremental migration is possible without breaking existing imports.

### Tradeoffs

- Some lint/config guardrails remain necessary to keep boundaries obvious.
- Contributors need to learn and follow layer boundaries.

## Guardrails

- ESLint boundary rules are active in `eslint.config.ts` for `src/domains/**`.
- `npm run validate:architecture` is reserved for durable checks that are hard to express cleanly in ESLint, tests, or docs.
- The current architecture validator keeps editor import/export/reorder/metadata workflows routed through their application use-cases instead of direct store/service/command bypasses.
- History commands are data-only payloads; execution/undo is centralized in `src/domains/history/application/command-executor.ts`.
- PR review uses the repository README plus this ADR as the human-facing source of truth, with change-specific validation recorded in the PR template.

## Migration Notes

- New work must be added to `src/domains/*` by default.
- Do not recreate retired legacy root folders.
