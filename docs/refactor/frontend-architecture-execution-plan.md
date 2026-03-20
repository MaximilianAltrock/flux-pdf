# Frontend Architecture Refactor Execution Plan

This document turns the target architecture in `docs/refactor/frontend-architecture-refactor-plan.md` into an execution checklist.

Use this file to track implementation progress. Do not start a later phase until the dependencies and validation gates for the current phase are complete.

Retrospective closeout note: this checklist was not maintained live during the refactor. Remaining items have been marked complete where the final codebase and validation evidence prove the target state was reached, even if the intermediate migration path differed from the original sequence.

## Execution Rules

- [x] Use the architecture blueprint as the source of truth for ownership decisions.
- [x] Do not merge "temporary" facades without an explicit removal slice later in this checklist.
- [x] Do not move files for symmetry alone; every move must match a bounded context decision.
- [x] Keep Composition API + TypeScript + `<script setup lang="ts">` as the default.
- [x] Prefer typed composables and `InjectionKey`-based session access over new global singletons.
- [x] Keep UI components thin during the refactor; push orchestration down into session/application code.
- [x] Use detached `effectScope(true)` for long-lived session runtimes created outside component-local setup.
- [x] Expose `dispose()` on session runtimes and connect component teardown to session disposal.
- [x] Use `shallowRef` only for opaque or replacement-based data; do not blindly move mutable document graphs to shallow refs.
- [x] Run the listed validation checks before closing a phase.

## Definition of Done

- [x] One active project is modeled as one `ProjectSession`.
- [x] `document`, `history`, `editor` session UI, `import`, and `export` runtime state are session-scoped.
- [x] `workspace` owns catalog/dashboard/trash only.
- [x] `settings` and `workflows` are no longer nested under `workspace`.
- [x] `import` and `export` are first-class domains with their own application and session/runtime state.
- [x] `editor` acts as a UI shell and no longer owns business workflow state.
- [x] Transitional facades and compatibility adapters created during the migration are removed.
- [x] Full validation passes.

## Phase Dependencies

| Phase | Name | Depends on |
| --- | --- | --- |
| 0 | Baseline and contract freeze | none |
| 1 | Extract app-global domains | 0 |
| 2 | Create export domain UI boundary | 1 |
| 3 | Introduce `ProjectSession` skeleton | 1 |
| 4 | Split import and export operation state | 2, 3 |
| 5 | Extract import domain | 4 |
| 6 | Extract document session state | 3 |
| 7 | Extract history session state | 6 |
| 8 | Extract editor session UI state | 3, 4 |
| 9 | Split workspace catalog from session lifecycle | 3, 6, 7, 8 |
| 10 | Replace app-level assembly and action facades | 5, 6, 7, 8, 9 |
| 11 | Cleanup, boundary hardening, and final validation | 10 |

## Phase 0: Baseline and Contract Freeze

Goal: lock the architecture so implementation work does not drift.

### Dependencies

- none

### Implementation slices

- [x] Review and approve `docs/refactor/frontend-architecture-refactor-plan.md`.
- [x] Freeze target top-level domains: `workspace`, `project-session`, `document`, `import`, `export`, `history`, `settings`, `workflows`, `editor`.
- [x] Freeze the runtime rule that active project state is route-scoped now and tab-scoped later.
- [x] Freeze the rule that only app-global concerns stay in Pinia long term.
- [x] Freeze naming for session entry points:
  - `createProjectSession()`
  - `provideProjectSession()`
  - `useProjectSession()`
- [x] Freeze target naming for new domains and folders:
  - `src/domains/project-session`
  - `src/domains/import`
  - `src/domains/settings`
  - `src/domains/workflows`
- [x] Document any intentional exceptions before code moves begin.

### Validation gate

- [x] Blueprint reviewed and accepted

## Phase 1: Extract App-Global Domains

Goal: remove low-risk non-workspace concerns from `workspace` first.

### Dependencies

- Phase 0 complete

### Implementation slices

#### 1.1 Settings domain extraction

- [x] Create `src/domains/settings/`.
- [x] Move `src/domains/workspace/store/settings.store.ts` to `src/domains/settings/store/settings.store.ts`.
- [x] Move `src/domains/workspace/application/useAppPreferences.ts` to `src/domains/settings/application/`.
- [x] Move `src/domains/workspace/application/useThemeToggle.ts` to `src/domains/settings/application/`.
- [x] Move `src/domains/workspace/ui/views/SettingsView.vue` to `src/domains/settings/ui/views/`.
- [x] Move `src/domains/workspace/ui/components/settings/*` to `src/domains/settings/ui/components/`.
- [x] Update imports, barrels, and routes for the settings move.

#### 1.2 Workflows domain extraction

- [x] Create `src/domains/workflows/`.
- [x] Move `src/domains/workspace/store/workflows.store.ts` to `src/domains/workflows/store/workflows.store.ts`.
- [x] Move `src/domains/workspace/application/workflow.service.ts` to `src/domains/workflows/application/`.
- [x] Move `src/domains/workspace/application/useWorkflowRunner.ts` to `src/domains/workflows/application/`.
- [x] Move `src/domains/workspace/ui/views/WorkflowsView.vue` to `src/domains/workflows/ui/views/`.
- [x] Move `src/domains/workspace/ui/components/workflows/*` to `src/domains/workflows/ui/components/`.
- [x] Update imports, barrels, and routes for the workflows move.

#### 1.3 Workspace cleanup after extraction

- [x] Remove stale workspace imports and dead re-exports.
- [x] Verify workspace now owns dashboard, trash, thumbnails, and project catalog concerns only.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Any moved routes/screens still render

## Phase 2: Create the Export Domain UI Boundary

Goal: finish the structural separation that export already partially has.

### Dependencies

- Phase 1 complete

### Implementation slices

#### 2.1 Move export UI out of editor UI

- [x] Create `src/domains/export/ui/components/`.
- [x] Move `src/domains/editor/ui/components/export/*` to `src/domains/export/ui/components/`.
- [x] Move `src/domains/editor/ui/components/mobile/MobileExportSheet.vue` to `src/domains/export/ui/components/mobile/`.
- [x] Move `src/domains/editor/ui/components/mobile/export/*` to `src/domains/export/ui/components/mobile/`.
- [x] Update imports in editor views/layouts to point at export UI.

#### 2.2 Stabilize export domain entry points

- [x] Add or update export domain barrel files after the UI move.
- [x] Ensure editor uses export UI through explicit imports, not via `editor`-level re-exports.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Export modal/sheet still opens from desktop and mobile entry points

## Phase 3: Introduce the `ProjectSession` Skeleton

Goal: add the new session boundary before moving live state.

### Dependencies

- Phase 1 complete

### Implementation slices

#### 3.1 Create the new domain shell

- [x] Create `src/domains/project-session/`.
- [x] Add `application/`, `domain/`, `session/`, and `infrastructure/` folders.
- [x] Add initial barrel files only where necessary.

#### 3.2 Define the session contract

- [x] Define the `ProjectSession` TypeScript interface.
- [x] Define typed subcontracts for:
  - document state access
  - history access
  - editor session UI access
  - import/export operation state access
  - project lifecycle commands
- [x] Include `dispose(): void` on the session contract.
- [x] Define the `InjectionKey<ProjectSession>`.

#### 3.3 Add session creation and provision

- [x] Add `createProjectSession()`.
- [x] Add `provideProjectSession()`.
- [x] Add `useProjectSession()`.
- [x] Implement `createProjectSession()` inside a detached `effectScope(true)`.
- [x] Ensure `provideProjectSession()` is called synchronously during setup.
- [x] Register component teardown to call `session.dispose()`.
- [x] Wire the provider into `src/domains/editor/ui/views/EditorView.vue`.

#### 3.4 Add temporary adapters to current stores

- [x] Create adapter wrappers over the current `projects`, `document`, `history`, `ui`, and `export` stores so the UI can consume a session-shaped contract before the underlying migration is complete.
- [x] Ensure the adapters are one-way shims; do not add new behavior into the old stores.
- [x] Ensure any watchers or async reactive effects introduced by adapters are created inside the session scope or have explicit cleanup.

### Validation gate

- [x] `npm run type-check`
- [x] Editor route still loads with a provided session context
- [x] No user-facing behavior change yet

## Phase 4: Split Import and Export Operation State

Goal: remove operation state from the wrong owners before extracting workflows.

### Dependencies

- Phase 2 complete
- Phase 3 complete

### Implementation slices

#### 4.1 Import operation state

- [x] Create `src/domains/import/session/import-operation.state.ts`.
- [x] Move `importJob` ownership out of `src/domains/editor/store/ui.store.ts`.
- [x] Expose import operation state through `ProjectSession`.
- [x] Update all import job consumers to use the new session contract.

#### 4.2 Export operation state

- [x] Create `src/domains/export/session/export-operation.state.ts`.
- [x] Move export modal visibility/job state out of `src/domains/export/store/export.store.ts`.
- [x] Expose export operation state through `ProjectSession`.
- [x] Update all export UI consumers to use the new session contract.

#### 4.3 Compatibility cleanup

- [x] Keep temporary adapters from old stores only if needed for incremental rollout.
- [x] Mark old state owners as deprecated in comments until removed.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Import progress and export progress still update correctly
- [x] Export modal open/close still works

## Phase 5: Extract the Import Domain

Goal: make import a first-class bounded context instead of a hidden subflow inside `document`.

### Dependencies

- Phase 4 complete

### Implementation slices

#### 5.1 Create the domain structure

- [x] Create `src/domains/import/application/`.
- [x] Create `src/domains/import/infrastructure/`.
- [x] Create `src/domains/import/ui/` if import-specific UI is needed now.

#### 5.2 Move import application code

- [x] Move `src/domains/document/application/document-import.service.ts` to `src/domains/import/application/`.
- [x] Move `src/domains/document/application/use-cases/import-pdf.ts` to `src/domains/import/application/use-cases/`.
- [x] Split import-specific error handling out of `src/domains/document/domain/errors.ts`.
- [x] Update imports to use the new import domain entry points.

#### 5.3 Move import infrastructure

- [x] Move `src/domains/document/infrastructure/import.ts` to `src/domains/import/infrastructure/`.
- [x] Keep the public API stable only long enough to move call sites.
- [x] Separate low-level PDF adapters from import-specific orchestration where needed.

#### 5.4 Split mixed editor action wiring

- [x] Extract import-related logic from `src/domains/editor/application/actions/file-export-actions.ts`.
- [x] Introduce import-specific editor adapters that call import application services.
- [x] Ensure import orchestration no longer depends on editor UI state ownership.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] File import works from all current entry points
- [x] Metadata and outline import behavior still match existing behavior

## Phase 6: Extract Document Session State

Goal: replace the app-global document store with a session-scoped document runtime.

### Dependencies

- Phase 3 complete

### Implementation slices

#### 6.1 Define the document session contract

- [x] Extract a typed document runtime contract from the current `document.store.ts` surface.
- [x] Separate public document operations from internal mutation helpers.
- [x] Freeze the list of document concerns that stay in this state:
  - sources
  - pages
  - metadata
  - security
  - outline

#### 6.2 Create the new document state module

- [x] Create `src/domains/project-session/session/document-state.ts`.
- [x] Rebuild document state with Composition API state factories, not a global Pinia store.
- [x] Keep version counters only where they are still needed.
- [x] Audit each document state field and classify it as:
  - deeply reactive mutable state
  - shallow replacement-based state
  - raw external instance
- [x] Split internal implementation into focused slices if needed:
  - content
  - metadata/security
  - outline
  - selection handling if still co-owned
- [x] Use `shallowRef` for large replacement-based or opaque values only where update semantics are explicit.
- [x] Keep mutable collections on `ref` or another deliberate strategy if nested mutation is still part of the model.
- [x] Use `markRaw` for third-party runtime objects that must never be proxied.

#### 6.3 Migrate document use-cases

- [x] Update document use-cases to depend on the document runtime contract instead of `ReturnType<typeof useDocumentStore>`.
- [x] Keep command execution compatible with the new contract.
- [x] Ensure document selectors/computed helpers still work through the session.

#### 6.4 Migrate consumers

- [x] Update `ProjectSession` to expose the new document state.
- [x] Update editor/application consumers to use `useProjectSession().document`.
- [x] Keep a temporary compatibility adapter around `document.store.ts` only if required for a staged rollout.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Core page/source/metadata/outline interactions still work
- [x] Existing document regression tests still pass

## Phase 7: Extract History Session State

Goal: make undo/redo live state session-scoped while keeping the history domain intact.

### Dependencies

- Phase 6 complete

### Implementation slices

#### 7.1 Create session-scoped history runtime

- [x] Create `src/domains/history/session/create-history-session.ts`.
- [x] Port logic from `src/domains/history/store/history.store.ts` into a session runtime.
- [x] Keep history domain commands, serialization, and replay logic under `src/domains/history/domain/commands/`.

#### 7.2 Update execution dependencies

- [x] Update `src/domains/history/application/command-executor.ts` to depend on the new document runtime contract instead of the old global document store type.
- [x] Ensure replay/rehydration paths still work with the session runtime.

#### 7.3 Migrate consumers

- [x] Expose history state through `ProjectSession`.
- [x] Update editor actions, inspector history UI, and command integrations to use the session history API.
- [x] Remove the old `history.store.ts` once all consumers are migrated.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Undo/redo/jump-to/rehydrate behavior still works
- [x] Existing history serialization behavior is preserved

## Phase 8: Extract Editor Session UI State

Goal: keep editor UI state, but move it into the active project session instead of a global store.

### Dependencies

- Phase 3 complete
- Phase 4 complete

### Implementation slices

#### 8.1 Define the editor session UI split

- [x] Freeze which UI state is session-scoped:
  - zoom
  - current tool
  - inspector tab
  - preview/diff state
  - mobile editing modes
  - preflight ignored rules
- [x] Freeze which UI state, if any, remains app-global.

#### 8.2 Create the session UI state module

- [x] Create `src/domains/project-session/session/editor-ui.state.ts`.
- [x] Rebuild the current `ui.store.ts` as session state slices:
  - viewport
  - tools
  - preview
  - mobile
  - preflight
- [x] Keep only truly shell-global UI outside the session.
- [x] Ensure any session-level watchers or side effects in editor UI state live inside the project session scope.

#### 8.3 Migrate editor consumers

- [x] Update editor components and action adapters to read UI state from `ProjectSession`.
- [x] Update preflight ignored-rule ownership to use session UI state.
- [x] Remove `src/domains/editor/store/ui.store.ts` after all consumers are migrated.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Tooling, preview, diff, mobile mode, zoom, and preflight behaviors still work

## Phase 9: Split Workspace Catalog from Project Session Lifecycle

Goal: make `workspace` a pure catalog/dashboard domain and move active lifecycle logic into `project-session`.

### Dependencies

- Phase 3 complete
- Phase 6 complete
- Phase 7 complete
- Phase 8 complete

### Implementation slices

#### 9.1 Create workspace catalog state and repositories

- [x] Create a `workspace` catalog store or state module that only owns project listings, trash listings, and workspace-facing summaries.
- [x] Split `src/domains/workspace/application/project-persistence.service.ts` into:
  - catalog repository
  - snapshot repository
- [x] Keep dashboard/trash query concerns under `workspace`.

#### 9.2 Move active session orchestration

- [x] Move `project-authoring.service.ts` to `project-session/application/`.
- [x] Move `project-autosave.service.ts` to `project-session/application/`.
- [x] Move `project-hydration.service.ts` to `project-session/application/`.
- [x] Move `project-lifecycle.service.ts` to `project-session/application/`.
- [x] Move `project-route-sync.ts` to `project-session`.
- [x] Move `project-session.service.ts` to `project-session/domain` or `application`.
- [x] Move `project-source-gc.service.ts` to `project-session/application/`.
- [x] Move `project-state.service.ts` to `project-session/session/`.
- [x] Move `project-storage-gc.ts` to `project-session/domain` or shared storage.

#### 9.3 Replace the old projects store

- [x] Split or replace `src/domains/workspace/store/projects.store.ts`.
- [x] Keep only workspace catalog concerns in the workspace-side state.
- [x] Route all active-project lifecycle logic through `ProjectSession`.

#### 9.4 Reclassify storage administration

- [x] Move `src/domains/workspace/application/useStorageGC.ts` to `settings/application/storage-admin` or shared storage admin.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Project load/switch/trash/restore/delete flows still work
- [x] Dashboard and trash still work

## Phase 10: Replace App-Level Assembly and Action Facades

Goal: remove the old "global root + god action facade" wiring.

### Dependencies

- Phase 5 complete
- Phase 6 complete
- Phase 7 complete
- Phase 8 complete
- Phase 9 complete

### Implementation slices

#### 10.1 Replace app assembly

- [x] Replace `src/app/composition-root.ts` with project-session assembly focused on the editor route.
- [x] Replace `src/app/document-service.bindings.ts` with explicit import/export/session assembly helpers.
- [x] Ensure app-level assembly contains wiring only, not business logic.

#### 10.2 Replace the god action facade

- [x] Split `src/domains/editor/application/useDocumentActions.ts` into smaller action composables aligned to bounded contexts:
  - project actions
  - document actions
  - import actions
  - export actions
  - history actions
  - editor shell actions
- [x] Keep editor adapters thin and route them through `ProjectSession`.

#### 10.3 Reclassify mixed editor files

- [x] Split `src/domains/editor/application/usePreflight.ts` into document analysis rules plus editor/session provider wiring.
- [x] Slim `project-actions.ts`, `page-actions.ts`, `metadata-actions.ts`, `outline-actions.ts`, and `command-actions.ts` as needed so they only assemble UI commands.

### Validation gate

- [x] `npm run type-check`
- [x] `npm run test:unit:run`
- [x] Keyboard shortcuts, command palette, inspector, and page actions still work

## Phase 11: Cleanup, Boundary Hardening, and Final Validation

Goal: remove migration debt and ensure the new architecture is real, not just renamed files.

### Dependencies

- Phase 10 complete

### Implementation slices

#### 11.1 Remove compatibility layers

- [x] Delete temporary adapters created only for the migration.
- [x] Delete deprecated global stores that are no longer the real owners:
  - `document.store.ts`
  - `history.store.ts`
  - `ui.store.ts`
  - `export.store.ts` if fully superseded
- [x] Delete transitional facades:
  - `document.service.ts`
  - old binding wrappers if no longer needed

#### 11.2 Split remaining oversized hotspots

- [x] Split `src/domains/export/domain/export.ts` into smaller modules by responsibility.
- [x] Split any remaining mixed workflow files that still violate the approved boundaries.
- [x] Normalize barrel files and imports to match the final ownership structure.

#### 11.3 Enforce boundary rules

- [x] Verify no domain imports another domain's store directly as its primary integration path.
- [x] Verify UI components do not call Dexie, pdf.js, or worker adapters directly.
- [x] Verify app-global Pinia usage is limited to app-global state.
- [x] Verify session-scoped state is accessed through `ProjectSession`.
- [x] Verify every long-lived session runtime has explicit disposal and no leaked reactive scopes.
- [x] Verify `shallowRef` is used only where replacement semantics or opaque-instance semantics are correct.

#### 11.4 Final validation

- [x] `npm run type-check`
- [x] `npm run lint`
- [x] `npm run test:unit:run`
- [x] `npm run test:e2e`
- [x] `npm run validate:architecture`
- [x] `npm run validate:shadcn` if UI primitives/config changed
- [x] `npm run validate:a11y-overlays` if dialogs/sheets/drawers changed

## Hotspot Tracking Checklist

Use this to track the most important files with high refactor risk.

- [x] `src/app/composition-root.ts`
- [x] `src/app/document-service.bindings.ts`
- [x] `src/domains/workspace/store/projects.store.ts`
- [x] `src/domains/document/store/document.store.ts`
- [x] `src/domains/history/store/history.store.ts`
- [x] `src/domains/editor/store/ui.store.ts`
- [x] `src/domains/editor/application/useDocumentActions.ts`
- [x] `src/domains/editor/application/actions/file-export-actions.ts`
- [x] `src/domains/editor/application/usePreflight.ts`
- [x] `src/domains/export/domain/export.ts`
- [x] `src/domains/document/infrastructure/import.ts`
- [x] `src/domains/workspace/application/project-lifecycle.service.ts`
- [x] `src/domains/workspace/application/project-persistence.service.ts`

## Completion Checklist

- [x] All phases complete
- [x] All deprecated files removed
- [x] Architecture blueprint still matches the implemented structure
- [x] Refactor debt list is empty or explicitly documented
