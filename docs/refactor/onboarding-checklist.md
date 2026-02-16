# Contributor Onboarding (Refactor Track)

## First Run

- [ ] Install dependencies: `npm ci`
- [ ] Verify baseline: `npm run type-check` and `npm run lint`
- [ ] Read `docs/adr/0001-domain-layered-architecture.md`
- [ ] Read `docs/refactor/workflow-checklist.md`

## Working Rules

- [ ] Add new behavior in `src/domains/*` first.
- [ ] Keep legacy paths (`src/stores/*`, `src/services/*`, `src/commands/*`) as migration wrappers only.
- [ ] Follow PR checklist in `.github/pull_request_template.md`.

## Skill Setup (Codex)

- [ ] Ensure required local skills are installed/updated:
  - `vue-best-practices`
  - `vue-development-guides`
  - `vue-pinia-best-practices`
  - `vue-testing-best-practices`
  - `create-adaptable-composable`
