# Refactor Plan (Logic and Readability)

## Scope and constraints

- Component refactors are now in scope for cleanup and DRY.
- Command pattern is already clean and stays as-is.
- Aim for single sources of truth and DRY where it improves clarity.

## Current focus: UI cleanup + DRY pass

1. Enforce facade-only writes in components (Done)
   - Why: the facade contract is the foundation; any direct command usage in UI breaks undo/redo guarantees.
   - Targets: `src/components/mobile/MobilePageGrid.vue` jump reorder, any direct command/store usage in components.
   - Test: `npm run test:unit:run`

2. Split oversized components into focused subcomponents
   - Why: large files hide logic, make reviews harder, and slow future edits.
   - Targets:
     - `src/components/InspectorPanel.vue` -> `InspectorStructureTab.vue`, `InspectorMetadataTab.vue`, `InspectorSecurityTab.vue`, `InspectorHistoryPanel.vue`
     - `src/components/ExportModal.vue` -> `ExportForm.vue`, `ExportProgress.vue`, `ExportSummary.vue`
   - Test: `npm run test:unit:run`

3. Consolidate shared grid helpers and UI fragments (Done)
   - Why: PageGrid/MobilePageGrid duplicate logic and markup (source color, divider UI, page numbering).
   - Targets: move helpers into `src/composables/useGridLogic.ts` and extract a shared divider/empty-state component if needed.
   - Done: source color helper centralized on `useDocumentView`.
   - Done: shared `PageDivider` component + shared content-page numbering helper in `useGridLogic`.
   - Test: `npm run test:unit:run`

4. Consolidate formatting utilities (Done)
   - Why: `format.ts` and `format-size.ts` overlap; local `formatTime()` duplicates `format.ts`.
   - Targets: merge into `src/utils/format.ts`, update imports, remove dead helpers.
   - Test: `npm run test:unit:run`

5. Naming + dead code cleanup (In progress)
   - Done: removed unused `src/components/Toolbar.vue`.
   - Why: clearer names make routing and ownership obvious; unused code is long-term drag.
   - Targets:
     - Rename desktop/mobile component pairs for clarity (e.g., `MicroHeader.vue` -> `DesktopHeader.vue`, `PageGrid.vue` -> `DesktopPageGrid.vue`).
     - Remove unused utilities/components (`src/components/Toolbar.vue`, `src/utils/scroll-to-page.ts`) after confirming no references.
   - Test: `npm run test:unit:run` and `npm run type-check`

## Archived proposals (completed or superseded)

2. Persist document metadata and security settings in the session
   - Why: metadata is currently volatile and split between `DocumentMetadata` and `PdfMetadata`. Persisting and unifying it removes repeat logic and makes exports consistent after reload.
   - Impact: Medium. Requires DB schema bump in `src/db/db.ts`, store changes in `src/stores/document.ts`, and persistence updates in `src/composables/useCommandManager.ts` and `src/composables/usePdfManager.ts`.
   - Urgency: High. (Done)

3. Add a content-pages selector in the store and use it everywhere
   - Why: `store.pages` includes dividers, but `pageCount` and export ranges want content pages only. Centralizing `contentPages` and `contentPageCount` avoids subtle bugs (export page range currently uses `store.pages.length`).
   - Impact: Medium. Updates in `src/stores/document.ts`, `src/composables/usePdfExport.ts`, and `src/composables/useKeyboardShortcuts.ts`.
   - Urgency: High. (Done)

4. Make divider pages an explicit type (no sentinel values)
   - Why: `SplitGroupCommand` creates dividers with `sourceFileId: 'virtual-divider'` and `sourcePageIndex: -1`. A discriminated union like `PageEntry = PageReference | DividerReference` prevents invalid data and clarifies logic.
   - Impact: Medium. Updates in `src/types/index.ts`, `src/commands/SplitGroupCommand.ts`, and any `isDivider` checks.
   - Urgency: High. (Done)

5. Create a single metadata model and mapping
   - Why: `DocumentMetadata` (store) and `PdfMetadata` (export) overlap. A shared model avoids duplication and clarifies which fields are persisted vs export-only.
   - Impact: Medium. New type module (for example `src/types/document.ts`) and a mapping helper in `src/composables/usePdfExport.ts`.
   - Urgency: Medium. (Done)

6. Introduce page factory helpers to avoid repeated page creation logic
   - Why: Page creation is duplicated in `src/composables/usePdfManager.ts` and `src/composables/useAppActions.ts`. A factory keeps IDs, rotation, and group IDs consistent.
   - Impact: Medium. Add a utility like `src/utils/page-factory.ts` and replace duplicate loops.
   - Urgency: Medium.

7. Separate core import/export logic from UI state and loading flags
   - Why: `usePdfManager` toggles loading state during file IO and `usePdfExport` bundles progress/UI state with the core export routine. Separating a pure service layer makes logic easier to test and avoids UI flicker during batch imports.
   - Impact: Medium. Introduce service modules for import/export and keep UI refs in composables; update `src/composables/useFileHandler.ts`, `src/composables/usePdfManager.ts`, and `src/composables/usePdfExport.ts`.
   - Urgency: Medium.

8. Unify document title state and defaults
   - Why: `useAppState.documentTitle` is passed into `DesktopLayout`, but `MicroHeader` reads `store.projectTitle` directly. This is a hidden duplicate and easy to drift. Metadata title defaults also conflict (`'Untitled Project'` vs empty string).
   - Impact: Low. Remove or wire `documentTitle`, add a `setProjectTitle` action, and align metadata defaults in `src/stores/document.ts`.
   - Urgency: Medium.

9. Centralize modal/shortcut blocking
   - Why: `useAppState.hasOpenModal` does not include `useConfirm().isOpen`, so keyboard shortcuts can fire while confirmation is open. A single modal registry avoids hidden interaction bugs.
   - Impact: Low to Medium. Update `src/composables/useAppState.ts` and optionally move shortcut guards into a small `useModalState` helper.
   - Urgency: Medium.

10. Centralize magic numbers into a single config module

- Why: Zoom limits, history size, thumbnail sizing, and breakpoints are scattered. Named constants improve readability and reduce accidental divergence.
- Impact: Low to Medium. Add `src/config/constants.ts` and replace inline numbers in `src/stores/document.ts`, `src/composables/useCommandManager.ts`, `src/composables/useThumbnailRenderer.ts`, and `src/composables/useMobile.ts`.
- Urgency: Medium.

11. Add source lifecycle and cache garbage collection

- Why: sources removed from the UI remain in `pdfDocCache` and IndexedDB, but removing immediately would break undo. Add a lifecycle policy (tombstone + GC when history is cleared or source is no longer referenced).
- Impact: Medium. Update `src/composables/usePdfManager.ts`, `src/composables/useCommandManager.ts`, and `src/commands/RemoveSourceCommand.ts`.
- Urgency: Medium.

12. Make core services true singletons

- Why: `usePdfManager` has per-instance `isInitialized` state while being used from multiple composables. This is easy to call twice and hard to reason about. A singleton service or Pinia store is clearer.
- Impact: Medium. Convert `usePdfManager` (and optionally `useThumbnailRenderer`) to a shared service module with module-level state.
- Urgency: Medium.

16. Add small, focused logic tests

- Why: `parsePageRange`, bookmark auto-generation, and export segmentation are easy to regress. Tests improve confidence without touching UI.
- Impact: Medium. Add unit tests under a new test folder and wire minimal runner config if needed.
- Urgency: Low to Medium.

## Architecture Concept (fixed, facade + internal modules)

- Single source of truth: `useDocumentStore` owns all document state (sources, pages, metadata, bookmarks, selection, zoom).
- Single public API: `useDocumentService` is the only composable UI calls for import/export/restore/clear/remove.
- Internal domain modules (not public): move import/export/session/history logic into `src/domain/document/` (for example `import.ts`, `export.ts`, `session.ts`, `history.ts`).
- `useDocumentService` orchestrates domain modules, command manager, and store, and owns job state (import/export/restore progress + errors).
- Legacy composables are removed; `src/composables/index.ts` re-exports only the service for domain workflows.

## Tracked Refactor Checklist (fixed milestones, test each)

- [x] Milestone 1: Define result + new domain structure
  - Add `src/types/result.ts` with `Result<T>` and `ResultError`.
  - Add `src/domain/document/index.ts` plus empty module files (`import.ts`, `export.ts`, `session.ts`, `history.ts`).
  - Add `src/composables/useDocumentService.ts` with job state refs and method stubs.
  - Test: `npm run type-check`
- [x] Milestone 2: Migrate import pipeline into domain module
  - Implement `src/domain/document/import.ts` and move PDF/image import logic there.
  - Remove `src/services/pdf-import.ts`, `src/composables/usePdfManager.ts`, and `src/composables/useFileHandler.ts`.
  - Update all imports/usages to call `useDocumentService.importFiles`.
  - Test: `npm run type-check`
- [x] Milestone 3: Migrate export pipeline into domain module
  - Implement `src/domain/document/export.ts` (raw PDF generation, segmentation, metadata).
  - Remove `src/services/pdf-export.ts` and `src/composables/usePdfExport.ts`.
  - Update all imports/usages to call `useDocumentService.exportDocument`.
  - Test: `npm run type-check`
- [x] Milestone 4: Centralize session persistence in domain
  - Implement `src/domain/document/session.ts` for DB persistence and restore.
  - `useCommandManager` exposes `serializeHistory()`/`rehydrateHistory()` only.
  - Test: `npm run type-check`
- [x] Milestone 5: Clean up domain helpers + finalize
  - Move import/export helpers under `src/domain/document/` (no new public utils).
  - Update `src/composables/index.ts` exports accordingly.
  - Test: `npm run type-check` and `npm run build-only`

## Maintainability Roadmap (next)

### Milestone 1: Contracts + error model (Done)

- [x] Add `src/types/errors.ts` with import/export error codes.
- [x] Add `src/domain/document/errors.ts` helpers for error creation + messaging.
- [x] Return error codes from import/export pipeline and map to UI messages.
- [x] Extend tests to assert error codes.
- [x] Test: `npm run test:unit:run`

### Milestone 2: Adapters + DI for I/O (Done)

- [x] Add `src/domain/document/ports.ts` and adapters in `src/domain/document/adapters/`.
- [x] Update `useDocumentService` to accept optional adapters (no module-level mocks).
- [x] Refactor unit tests to inject adapters.
- [x] Test: `npm run test:unit:run`

### Milestone 3: Persistence + command versioning (Done)

- [x] Add session/command schema versions and migration helpers.
- [x] Update command serialization to include version metadata.
- [x] Add tests for migrations and command rehydration.
- [x] Test: `npm run test:unit:run`

### Milestone 4: UI centralization + facade (In progress)

- Goal: UI calls only one facade; all document mutations go through actions; undoable ops are explicit.
- Why: reduces coupling, prevents "hidden" write paths, and makes undo/redo reliable.

1. Introduce a facade composable (Done)
   - Create `src/composables/useDocumentFacade.ts` that exposes `{ state, actions }`.
   - `state` is UI-only (modals, sheets, preview, selection mode).
   - `actions` is the single write API (selection, edits, import/export, history).
   - Why: one import in UI = easy audit and consistent behavior.
   - Test: `npm run test:unit:run`

2. Move all undoable mutations behind actions + command manager (Done)
   - Move usages of `useCommandManager` out of components into actions.
   - Commands handle: reorder, split, rotate, duplicate, delete, remove source, add pages.
   - Keep non-undoable changes out of command history: selection, preview state, loading flags.
   - Why: undo/redo becomes a contract; no mutation bypasses history.
   - Test: `npm run test:unit:run`

3. Centralize import/export entry points (Done)
   - SourceRail, file drops, mobile sheets call `actions.handleFilesSelected`.
   - ExportModal builds options only; `actions.exportDocument` handles progress + download.
   - Why: identical behavior and error handling across UI paths.
   - Test: `npm run test:unit:run`

4. Remove direct store/service/command access from UI (Done)
   - Components/layouts only receive `state` and `actions` props.
   - `src/App.vue` is the only place that constructs the facade.
   - Why: enforces the architecture and makes component cleanup bounded.
   - Test: `npm run test:unit:run`

5. Separate UI-only state from document store (Done)
   - Move `zoom`, `currentTool`, `isLoading`, `loadingMessage` into UI state.
   - Update selectors/usages to read from facade state instead of store.
   - Why: document store remains domain-only and easier to persist.
   - Test: `npm run test:unit:run`

6. Add action-level tests for history behavior (Done)
   - Add tests that verify undo/redo for all command-backed actions.
   - Add tests that verify non-undoable actions do not affect history.
   - Why: guarantees the undo contract as the codebase grows.
   - Test: `npm run test:unit:run`

### Milestone 5: Component cleanup + DRY pass (Planned)

- Goal: reduce UI complexity, remove duplication, and make component intent clearer without adding architectural bloat.

1. Enforce facade-only writes in components (Done)
   - Fix any direct command usage (start with mobile page jump reorder).
   - Test: `npm run test:unit:run`
2. Split oversized components
   - InspectorPanel -> Structure/Metadata/Security tabs + History panel subcomponents.
   - ExportModal -> ExportForm + ExportState (progress/success/error) subcomponents.
   - Test: `npm run test:unit:run`
3. Consolidate shared grid helpers + fragments (Done)
   - Move page helper logic into `useGridLogic` and share divider/empty UI.
   - Test: `npm run test:unit:run`
4. Consolidate formatting utilities (Done)
   - Merge `format-size.ts` into `format.ts`; replace local `formatTime()` usage.
   - Test: `npm run test:unit:run`
5. Naming + dead code cleanup (In progress)
   - Rename desktop/mobile components for clarity; remove unused files after confirming no references.
   - Test: `npm run test:unit:run` and `npm run type-check`
