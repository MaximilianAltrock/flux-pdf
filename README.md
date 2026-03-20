# Flux PDF

Flux PDF is a Vue 3 + TypeScript PDF workflow editor with domain-first architecture.

## Architecture At A Glance

- Code is organized by owning workflow/domain under `src/domains/*`.
- Common layers are `ui`, `application`, `domain`, `infrastructure`, `session`, and `store`.
- Each domain keeps only the layers it actually needs.
- `domain` stays framework-free.
- `application` orchestrates use-cases and shared workflow logic.
- UI depends on `application`/`domain` APIs instead of infrastructure adapters.
- `history/domain/commands` are serializable payloads; execution is centralized in `history/application`.

## Working In The Repo

- Add feature-specific logic to the owning domain first.
- Put shared infrastructure and UI primitives under `src/shared/*`.
- Use [`docs/adr/0001-domain-layered-architecture.md`](docs/adr/0001-domain-layered-architecture.md) as the architecture source of truth.
- Use [`docs/refactor/codebase-cleanup-plan.md`](docs/refactor/codebase-cleanup-plan.md) as the active cleanup/refactor source of truth.

## Guardrails

Run these before opening a PR:

```bash
npm run type-check
npm run lint
npm run test:unit:run
npm run validate:architecture
```

Use these when relevant:

```bash
npm run test:e2e
npm run validate:shadcn
npm run validate:a11y-overlays
```

## Key Docs

- ADR: `docs/adr/0001-domain-layered-architecture.md`
- Cleanup plan: `docs/refactor/codebase-cleanup-plan.md`
- Branch protection: `docs/refactor/branch-protection.md`
