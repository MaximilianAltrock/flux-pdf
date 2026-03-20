# Flux PDF Refactor Workflow Checklist

Use this file as a short PR-prep checklist. The detailed rules live in:

- [`docs/adr/0001-domain-layered-architecture.md`](../adr/0001-domain-layered-architecture.md)
- [`docs/refactor/codebase-cleanup-plan.md`](./codebase-cleanup-plan.md)
- [`README.md`](../../README.md)

## Checklist

- [ ] The owning domain and layer follow the ADR instead of introducing a new local structure rule.
- [ ] Behavior tests were added or updated for the changed functionality.
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run test:unit:run`
- [ ] `npm run validate:architecture` for editor workflow/application boundary changes
- [ ] `npm run test:e2e` for UI/interaction changes
- [ ] `npm run validate:shadcn` for shared UI primitive/config changes
- [ ] `npm run validate:a11y-overlays` for dialog/sheet/drawer changes
- [ ] Validation commands actually run are recorded in the PR template
