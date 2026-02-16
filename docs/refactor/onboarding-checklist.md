# Contributor Onboarding (Refactor Track)

## First Run

- [ ] Install dependencies: `npm ci`
- [ ] Verify baseline: `npm run type-check` and `npm run lint`
- [ ] Read `docs/adr/0001-domain-layered-architecture.md`
- [ ] Read `docs/refactor/domain-layer-matrix.json`
- [ ] Read `docs/refactor/workflow-checklist.md`
- [ ] Read `docs/refactor/visual-standard.md`
- [ ] Read `docs/refactor/branch-protection.md`

## Working Rules

- [ ] Add new behavior in `src/domains/*` first.
- [ ] Do not reintroduce legacy paths (`src/stores/*`, `src/services/*`, `src/commands/*`).
- [ ] Follow PR checklist in `.github/pull_request_template.md`.
- [ ] For UI refactors, run `npm run validate:shadcn`.
- [ ] For overlay refactors (dialogs/sheets/drawers), run `npm run validate:a11y-overlays`.
- [ ] Run `npm run validate:architecture` before opening a PR.

## Skill Setup (Codex)

- [ ] Ensure required local skills are installed/updated:
  - `vue-best-practices`
  - `vue-development-guides`
  - `vue-pinia-best-practices`
  - `vue-testing-best-practices`
  - `create-adaptable-composable`
- [ ] Verify Codex skill install/update flow works on your machine (via skill-installer workflow).
