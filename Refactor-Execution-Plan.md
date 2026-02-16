# Flux PDF Concrete Refactor Execution Plan

This plan translates `Refactor-Plan.md` into phased, trackable work for a clean and maintainable Vue 3 codebase.

## Execution Status (2026-02-16)

- Completed in this pass: Phase 0, Phase 1, targeted Phase 2/3/8 items, Waves 1-4 hotspots, mobile editor splits (`MobilePageGrid.vue`, `MobileTopBar.vue`, `MobileMenuDrawer.vue`, `MobileExportSheet.vue`), route-shell hardening, Phase 5 type/contract consolidation, CI/shadcn hardening baseline, Phase 7 overlay accessibility/wrapper hardening, workspace store-thinning progress (workflow service extraction + project source-GC/session/persistence/hydration/autosave/thumbnail/lifecycle/authoring/state-controller extraction), domain-store relocation (`projects`, `workflows`, `ui`, `settings`) with full legacy wrapper removal, legacy `src/domain/*` migration into `src/domains/*`, full root-layer migration into `src/app`, `src/shared`, and `src/domains`, removal of empty scaffold folders, editor UI composable flattening, shared `useMobile` extraction, UI-to-infrastructure dependency cleanup in preview flow, VueUse `useRefHistory` adoption for lightweight settings history, architecture convention validation (`validate:architecture`), and branch-protection apply/verify wiring docs/scripts.
- Remediation update (Phase 0): canonical per-domain layer requirements now live in `docs/refactor/domain-layer-matrix.json` and are validated in `validate:architecture`.
- Remediation update (Phases 1-4): export domain state ownership, runtime use-case wiring, editor action decomposition, and architecture/use-case guardrails are complete and test-validated.
- Remaining: Phase 5 documentation closeout items (baseline refresh, branch-protection verification evidence, known exceptions) are tracked in `Refactor-Remediation-Plan.md`.

## Skill Coverage (All Available Skills)

- [x] `create-adaptable-composable`: standardize composable inputs to `MaybeRef` / `MaybeRefOrGetter` with `toRef()` / `toValue()`.
- [x] `frontend-design`: keep a clear visual system and intentional UI patterns while refactoring.
- [x] `shadcn-vue`: keep `components.json` aligned with aliases, Tailwind variables, and generated component conventions.
- [x] `vue-best-practices`: Composition API + `<script setup lang="ts">` as default for all Vue work.
- [x] `vue-development-guides`: enforce reactivity, SFC, data-flow, and state-management checklists.
- [x] `vue-jsx-best-practices`: if JSX/TSX is used, enforce Vue JSX syntax (`class`, not React-style `className`) and plugin config.
- [x] `vue-options-api-best-practices`: treat Options API as legacy-only; type and stabilize where conversion is not immediate.
- [x] `vue-pinia-best-practices`: domain stores, correct store reactivity usage, and stable setup patterns.
- [x] `vue-router-best-practices`: fix guard flow, route-param lifecycle handling, and cleanup behavior.
- [x] `vue-testing-best-practices`: strengthen Vitest + Vue Test Utils + Playwright coverage and test design.
- [x] `vueuse-functions`: replace bespoke utility logic with VueUse composables where applicable.
- [x] `skill-creator`: codify recurring refactor workflows into local skills/checklists for team reuse.
- [x] `skill-installer`: verify team machines can install/update required Codex skills from curated sources when needed.

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
- [x] Define a canonical domain-layer matrix with required/optional/deferred layers per domain (`docs/refactor/domain-layer-matrix.json`).
- [x] Add temporary migration aliases so old imports keep working during phased moves.
- [x] Move and adapt current modules first by highest value:
- [x] `src/stores/document.ts` -> `src/domains/document/store`.
- [x] `src/stores/history.ts` + `src/commands/*` -> `src/domains/history`.
- [x] `src/services/documentService.ts` and `src/services/pdfRepository.ts` -> domain infrastructure adapters.
- [x] Keep `src/shared/components/ui/*` as shared primitives (shadcn-vue layer), not domain logic containers.

### Exit Criteria
- [x] New domain skeleton exists and is used by at least one end-to-end editor flow.
- [x] No new code is added to legacy flat folders unless explicitly approved.

## Phase 2 - State, Commands, and Use-Case Layer

### Goal
Make state predictable and isolate business behavior from UI.

### Checklist
- [x] Split state into domain Pinia stores (`workspace`, `document`, `editor`, `history`, `export`).
- [x] Ensure store consumption uses `storeToRefs()` where needed to avoid reactivity loss.
- [x] Create application-level use cases (`importPdf`, `reorderPages`, `updateMetadata`, `executeCommand`, `exportPdf`).
- [x] Keep store actions thin: orchestration only; move business rules to domain/application modules.
- [x] Normalize command pattern contracts (`execute`, `undo`, `label`, payload typing) and central history orchestration.
- [x] Add command batching/grouping strategy for drag/reorder and multi-step edits.

### Exit Criteria
- [x] Undo/redo behavior is command-driven and tested.
- [x] Core document operations no longer depend on component internals.

## Phase 3 - Composable and Reactivity Refactor

### Goal
Reduce brittle logic and standardize composable APIs.

### Checklist
- [x] Split large composables (`src/domains/editor/application/useDocumentActions.ts`) into focused domain composables.
- [x] Apply adaptable composable signatures (`MaybeRef` / `MaybeRefOrGetter`) where inputs may be static, refs, or getters.
- [x] Resolve reactive inputs with `toRef()` / `toValue()` inside watchers/effects.
- [x] Replace bespoke utilities with VueUse where a direct equivalent exists:
- [x] `useLocalStorage`/`useStorage` for persistence.
- [x] `useEventListener` and keyboard helpers for shortcut wiring.
- [x] `useBreakpoints`/`useMediaQuery` for mobile/desktop behavior.
- [x] `useRefHistory` family for lightweight local history where command bus is not required.
- [x] Enforce reactivity rules: no direct destructuring from `reactive()` without `toRefs`, no side effects in `computed()`.

### Exit Criteria
- [x] Composables are smaller, typed, and reusable across desktop/mobile shells.
- [x] Duplicate utility logic is reduced and replaced by VueUse where appropriate.

## Phase 4 - Component, Layout, and Router Cleanup

### Goal
Stabilize UI architecture and reduce oversized view/component files.

### Checklist
- [x] Keep route-level dual-shell approach: desktop and mobile containers with shared domain logic.
- [x] Refactor oversized files first:
- [x] `src/domains/workspace/ui/views/SettingsView.vue`
- [x] `src/domains/editor/ui/components/PagePreviewModal.vue`
- [x] `src/domains/editor/ui/components/PageGrid.vue`
- [x] `src/domains/editor/ui/components/mobile/MobilePageGrid.vue`
- [x] `src/domains/editor/ui/components/mobile/MobileTopBar.vue`
- [x] `src/domains/editor/ui/components/mobile/MobileMenuDrawer.vue`
- [x] `src/domains/editor/ui/components/mobile/MobileExportSheet.vue`
- [x] Split container vs presentational concerns (store wiring in containers, pure props/events in presentational components).
- [x] Enforce SFC practices: stable `:key`, avoid `v-if` + `v-for` on same element, scoped styles by default.
- [x] Router hardening:
- [x] Guard logic uses awaited async patterns and avoids redirect loops.
- [x] Route param changes are handled explicitly without stale data.
- [x] Listener cleanup is verified on route transitions.
- [x] JSX/TSX rule: if used, keep Vue JSX syntax and lint checks.

### Exit Criteria
- [x] Top 10 largest UI files are reduced to focused responsibilities.
- [x] Route transitions are predictable with no known guard/lifecycle regressions.

## Phase 5 - Types, Constants, and Public Contracts

### Goal
Make business language explicit and remove magic values.

### Checklist
- [x] Move domain types near domain logic (`domains/*/domain/types.ts`).
- [x] Introduce shared cross-domain constants (`shared/constants/*`) for shortcuts, feature flags, and storage keys.
- [x] Prefer `as const` + literal unions for most finite sets; keep `enum` only where runtime enum semantics are needed.
- [x] Standardize error/result contracts in `src/shared/types/result.ts` and `src/shared/types/errors.ts` usage.
- [x] Remove duplicate or conflicting type definitions across `src/shared/types`, `src/domains/*/domain`, and composables.

### Exit Criteria
- [x] Type ownership is clear and discoverable.
- [x] Magic strings/numbers are removed from feature code paths.

## Phase 6 - Testing and Regression Safety

### Goal
Protect refactor work with targeted, behavior-first tests.

### Checklist
- [x] Add/expand unit tests for domain services and command handlers.
- [x] Add Pinia store tests with proper test setup (no missing active pinia issues).
- [x] Add component tests for critical editor interactions (black-box style, minimal snapshot reliance).
- [x] Add async/race-condition tests for watchers and command execution.
- [x] Add Playwright smoke journeys:
- [x] import PDF -> reorder -> edit metadata -> undo/redo -> export.
- [x] mobile navigation path for core actions.
- [x] Require changed behavior to include tests before merge.

### Exit Criteria
- [x] Critical document-editing workflows are covered in unit + component + e2e tests.
- [x] CI blocks merges on failing type/lint/test gates.

## Phase 7 - shadcn-vue and Design System Hardening

### Goal
Keep UI primitives consistent and avoid drift during refactor.

### Checklist
- [x] Verify `components.json` aliases match TS/Vite aliases (`@/*`) and remain committed.
- [x] Keep Tailwind CSS variables enabled and token usage centralized in `src/assets/main.css`.
- [x] Audit custom wrappers around shadcn/reka components for duplication and remove unnecessary variants.
- [x] Ensure accessibility props and keyboard behavior remain intact on refactored dialogs, sheets, menus, and forms.
- [x] Define a small visual standard (typography scale, spacing tokens, motion timing, color roles) for all touched screens.

### Exit Criteria
- [x] Shared UI primitives are reused consistently across desktop/mobile/editor/settings.
- [x] Refactored UI remains accessible and visually coherent.

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
- [x] New feature work follows the same architecture without reintroducing old patterns.

## Suggested Execution Order for Current Hotspots

- [x] Wave 1: `src/domains/editor/application/useDocumentActions.ts`, `src/stores/document.ts`, `src/stores/history.ts`, `src/services/documentService.ts`.
- [x] Wave 2: `src/domains/editor/ui/components/PageGrid.vue`, `src/domains/editor/ui/components/PagePreviewModal.vue`, `src/domains/editor/ui/components/SourcePageGrid.vue`.
- [x] Wave 3: `src/domains/workspace/ui/views/SettingsView.vue`, `src/domains/workspace/ui/views/WorkflowsView.vue`, `src/domains/workspace/ui/views/DashboardView.vue`.
- [x] Wave 4: mobile editor files under `src/domains/editor/ui/components/mobile/*` and route-shell cleanup.

## Definition of Done (Overall)

- [x] Domain-first folder structure is in active use.
- [x] Core logic is testable without rendering Vue components.
- [x] Vue code follows Composition API + typed `<script setup>` by default.
- [x] Stores are modular and reactivity-safe.
- [x] Router, commands, and undo/redo are stable and tested.
- [x] shadcn-vue primitives are consistent and accessible.
- [x] Team has a reusable workflow to keep architecture clean over time.
