# Contributor Onboarding

This file is an entry point only. The detailed architecture and cleanup rules live in:

- [`docs/adr/0001-domain-layered-architecture.md`](../adr/0001-domain-layered-architecture.md)
- [`docs/refactor/codebase-cleanup-plan.md`](./codebase-cleanup-plan.md)
- [`README.md`](../../README.md)

## First Run

- [ ] Install dependencies: `npm ci`
- [ ] Verify the baseline: `npm run type-check`, `npm run lint`, and `npm run test:unit:run`
- [ ] Read the ADR before changing architecture-sensitive code
- [ ] Read the cleanup plan before continuing any active cleanup phase
- [ ] Read `docs/refactor/visual-standard.md` before substantial UI work
- [ ] Read `docs/refactor/branch-protection.md` only if you need repository protection setup

## Before Opening A PR

- [ ] Follow `.github/pull_request_template.md`
- [ ] Run `npm run validate:architecture` for editor workflow/application boundary changes
- [ ] Run `npm run test:e2e` for UI or interaction changes
- [ ] Run `npm run validate:shadcn` for shared UI primitive/config changes
- [ ] Run `npm run validate:a11y-overlays` for dialog/sheet/drawer changes
