# Flux PDF Concrete Refactor Execution Plan

This plan translates `Refactor-Plan.md` into phased, trackable work for a clean and maintainable Vue 3 codebase.

## Execution Status (2026-02-16)

- Completed in this pass: Phase 0, Phase 1, targeted Phase 2/3/8 items, Wave 1 hotspots.
- Remaining: large component/view splits, router hardening, and test coverage expansion.

## Skill Coverage (All Available Skills)

- [x] `create-adaptable-composable`: standardize composable inputs to `MaybeRef` / `MaybeRefOrGetter` with `toRef()` / `toValue()`.
- [ ] `frontend-design`: keep a clear visual system and intentional UI patterns while refactoring.
- [ ] `shadcn-vue`: keep `components.json` aligned with aliases, Tailwind variables, and generated component conventions.
- [x] `vue-best-practices`: Composition API + `<script setup lang="ts">` as default for all Vue work.
- [x] `vue-development-guides`: enforce reactivity, SFC, data-flow, and state-management checklists.
- [ ] `vue-jsx-best-practices`: if JSX/TSX is used, enforce Vue JSX syntax (`class`, not React-style `className`) and plugin config.
- [ ] `vue-options-api-best-practices`: treat Options API as legacy-only; type and stabilize where conversion is not immediate.
- [x] `vue-pinia-best-practices`: domain stores, correct store reactivity usage, and stable setup patterns.
- [ ] `vue-router-best-practices`: fix guard flow, route-param lifecycle handling, and cleanup behavior.
- [ ] `vue-testing-best-practices`: strengthen Vitest + Vue Test Utils + Playwright coverage and test design.
- [ ] `vueuse-functions`: replace bespoke utility logic with VueUse composables where applicable.
- [x] `skill-creator`: codify recurring refactor workflows into local skills/checklists for team reuse.
- [ ] `skill-installer`: verify team machines can install/update required Codex skills from curated sources when needed.

## Phase 0 - Baseline and Quality Gates

### Goal
Lock in safety rails before structural change.

### Checklist
- [x] Capture baseline: `npm run type-check`, `npm run lint`, `npm run test:unit:run`, `npm run test:e2e`.
- [x] Record current architecture inventory (stores, services, composables, commands, large files).
- [x] Create an ADR that defines target layers: `ui -> application -> domain -> infrastructure`.
- [x] Add dependency boundary lint rules (`eslint` import boundaries or equivalent).
- [x] Define PR checklist requiring: typed APIs, no hidden side effects in computed, props-down/events-up, and tests for changed behavior.

### Exit Criteria
- [x] Baseline metrics and failing areas are documented.
- [x] Boundary rules and PR checklist are active in repo docs/CI.

## Phase 1 - Establish Target Domain Structure

### Goal
Move from mixed file-type organization to domain-first structure from `Refactor-Plan.md`.

### Checklist
- [x] Create target folders: `src/app`, `src/shared`, `src/domains/{workspace,document,editor,history,export}`.
- [x] Define per-domain subfolders: `ui`, `store`, `application`, `domain`, `infrastructure`.
- [x] Add temporary migration aliases so old imports keep working during phased moves.
- [ ] Move and adapt current modules first by highest value:
- [x] `src/stores/document.ts` -> `src/domains/document/store`.
- [x] `src/stores/history.ts` + `src/commands/*` -> `src/domains/history`.
- [x] `src/services/documentService.ts` and `src/services/pdfRepository.ts` -> domain infrastructure adapters.
- [x] Keep `src/components/ui/*` as shared primitives (shadcn-vue layer), not domain logic containers.

### Exit Criteria
- [x] New domain skeleton exists and is used by at least one end-to-end editor flow.
- [x] No new code is added to legacy flat folders unless explicitly approved.

## Phase 2 - State, Commands, and Use-Case Layer

### Goal
Make state predictable and isolate business behavior from UI.

### Checklist
- [ ] Split state into domain Pinia stores (`workspace`, `document`, `editor`, `history`, `export`).
- [x] Ensure store consumption uses `storeToRefs()` where needed to avoid reactivity loss.
- [x] Create application-level use cases (`importPdf`, `reorderPages`, `updateMetadata`, `executeCommand`, `exportPdf`).
- [ ] Keep store actions thin: orchestration only; move business rules to domain/application modules.
- [x] Normalize command pattern contracts (`execute`, `undo`, `label`, payload typing) and central history orchestration.
- [ ] Add command batching/grouping strategy for drag/reorder and multi-step edits.

### Exit Criteria
- [ ] Undo/redo behavior is command-driven and tested.
- [ ] Core document operations no longer depend on component internals.

## Phase 3 - Composable and Reactivity Refactor

### Goal
Reduce brittle logic and standardize composable APIs.

### Checklist
- [x] Split large composables (`src/composables/useDocumentActions.ts`) into focused domain composables.
- [x] Apply adaptable composable signatures (`MaybeRef` / `MaybeRefOrGetter`) where inputs may be static, refs, or getters.
- [x] Resolve reactive inputs with `toRef()` / `toValue()` inside watchers/effects.
- [ ] Replace bespoke utilities with VueUse where a direct equivalent exists:
- [ ] `useLocalStorage`/`useStorage` for persistence.
- [ ] `useEventListener` and keyboard helpers for shortcut wiring.
- [ ] `useBreakpoints`/`useMediaQuery` for mobile/desktop behavior.
- [ ] `useRefHistory` family for lightweight local history where command bus is not required.
- [ ] Enforce reactivity rules: no direct destructuring from `reactive()` without `toRefs`, no side effects in `computed()`.

### Exit Criteria
- [ ] Composables are smaller, typed, and reusable across desktop/mobile shells.
- [ ] Duplicate utility logic is reduced and replaced by VueUse where appropriate.

## Phase 4 - Component, Layout, and Router Cleanup

### Goal
Stabilize UI architecture and reduce oversized view/component files.

### Checklist
- [ ] Keep route-level dual-shell approach: desktop and mobile containers with shared domain logic.
- [ ] Refactor oversized files first:
- [ ] `src/views/SettingsView.vue`
- [ ] `src/components/editor/PagePreviewModal.vue`
- [ ] `src/components/editor/PageGrid.vue`
- [ ] `src/components/editor/mobile/MobilePageGrid.vue`
- [ ] Split container vs presentational concerns (store wiring in containers, pure props/events in presentational components).
- [ ] Enforce SFC practices: stable `:key`, avoid `v-if` + `v-for` on same element, scoped styles by default.
- [ ] Router hardening:
- [ ] Guard logic uses awaited async patterns and avoids redirect loops.
- [ ] Route param changes are handled explicitly without stale data.
- [ ] Listener cleanup is verified on route transitions.
- [ ] JSX/TSX rule: if used, keep Vue JSX syntax and lint checks.

### Exit Criteria
- [ ] Top 10 largest UI files are reduced to focused responsibilities.
- [ ] Route transitions are predictable with no known guard/lifecycle regressions.

## Phase 5 - Types, Constants, and Public Contracts

### Goal
Make business language explicit and remove magic values.

### Checklist
- [ ] Move domain types near domain logic (`domains/*/domain/types.ts`).
- [ ] Introduce shared cross-domain constants (`shared/constants/*`) for shortcuts, feature flags, and storage keys.
- [ ] Prefer `as const` + literal unions for most finite sets; keep `enum` only where runtime enum semantics are needed.
- [ ] Standardize error/result contracts in `src/types/result.ts` and `src/types/errors.ts` usage.
- [ ] Remove duplicate or conflicting type definitions across `src/types`, `src/domain`, and composables.

### Exit Criteria
- [ ] Type ownership is clear and discoverable.
- [ ] Magic strings/numbers are removed from feature code paths.

## Phase 6 - Testing and Regression Safety

### Goal
Protect refactor work with targeted, behavior-first tests.

### Checklist
- [ ] Add/expand unit tests for domain services and command handlers.
- [ ] Add Pinia store tests with proper test setup (no missing active pinia issues).
- [ ] Add component tests for critical editor interactions (black-box style, minimal snapshot reliance).
- [ ] Add async/race-condition tests for watchers and command execution.
- [ ] Add Playwright smoke journeys:
- [ ] import PDF -> reorder -> edit metadata -> undo/redo -> export.
- [ ] mobile navigation path for core actions.
- [ ] Require changed behavior to include tests before merge.

### Exit Criteria
- [ ] Critical document-editing workflows are covered in unit + component + e2e tests.
- [ ] CI blocks merges on failing type/lint/test gates.

## Phase 7 - shadcn-vue and Design System Hardening

### Goal
Keep UI primitives consistent and avoid drift during refactor.

### Checklist
- [ ] Verify `components.json` aliases match TS/Vite aliases (`@/*`) and remain committed.
- [ ] Keep Tailwind CSS variables enabled and token usage centralized in `src/assets/main.css`.
- [ ] Audit custom wrappers around shadcn/reka components for duplication and remove unnecessary variants.
- [ ] Ensure accessibility props and keyboard behavior remain intact on refactored dialogs, sheets, menus, and forms.
- [ ] Define a small visual standard (typography scale, spacing tokens, motion timing, color roles) for all touched screens.

### Exit Criteria
- [ ] Shared UI primitives are reused consistently across desktop/mobile/editor/settings.
- [ ] Refactored UI remains accessible and visually coherent.

## Phase 8 - Team Workflow and Skill Operationalization

### Goal
Make the new architecture repeatable by contributors.

### Checklist
- [x] Create an internal skill/checklist for this codebase refactor workflow (domain boundaries, composable API rules, testing gates).
- [x] Keep skill docs concise and reference-heavy (no duplicated long guidance).
- [x] Provide optional setup note for installing/updating required Codex skills on contributor machines.
- [x] Add a lightweight onboarding checklist for new contributors tied to this plan.

### Exit Criteria
- [x] Refactor standards are documented once and reused consistently.
- [ ] New feature work follows the same architecture without reintroducing old patterns.

## Suggested Execution Order for Current Hotspots

- [x] Wave 1: `src/composables/useDocumentActions.ts`, `src/stores/document.ts`, `src/stores/history.ts`, `src/services/documentService.ts`.
- [ ] Wave 2: `src/components/editor/PageGrid.vue`, `src/components/editor/PagePreviewModal.vue`, `src/components/editor/SourcePageGrid.vue`.
- [ ] Wave 3: `src/views/SettingsView.vue`, `src/views/WorkflowsView.vue`, `src/views/DashboardView.vue`.
- [ ] Wave 4: mobile editor files under `src/components/editor/mobile/*` and route-shell cleanup.

## Definition of Done (Overall)

- [ ] Domain-first folder structure is in active use.
- [ ] Core logic is testable without rendering Vue components.
- [ ] Vue code follows Composition API + typed `<script setup>` by default.
- [ ] Stores are modular and reactivity-safe.
- [ ] Router, commands, and undo/redo are stable and tested.
- [ ] shadcn-vue primitives are consistent and accessible.
- [ ] Team has a reusable workflow to keep architecture clean over time.
