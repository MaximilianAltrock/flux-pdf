# Flux PDF

Flux PDF is a Vue 3 + TypeScript PDF workflow editor with domain-first architecture.

## Architecture At A Glance

- Code is organized by domain under `src/domains`:
  - `document`, `editor`, `export`, `history`, `workspace`
- Each domain uses standardized layers:
  - `ui`, `store`, `application`, `domain`, `infrastructure`
- `domain` stays framework-free.
- `application` orchestrates use-cases and may use Vue reactivity/composables.
- `history/domain/commands` are serializable payloads; execution is centralized in `history/application`.
- App-level service wiring is centralized in `src/app/composition-root.ts`.

## Where To Add New Code

- Add feature-specific logic to the owning domain first.
- Put pure business rules in `domain`.
- Put orchestration/use-case flow in `application`.
- Put Pinia state in `store`.
- Put components/views in `ui`.
- Put external adapters (DB, workers, file APIs) in `infrastructure`.

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
- Layer matrix: `docs/refactor/domain-layer-matrix.json`
- Workflow checklist: `docs/refactor/workflow-checklist.md`
