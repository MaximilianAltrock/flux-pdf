# Refactor Plan (Logic and Readability)

## Scope and constraints

- No component refactors. Only logic, types, stores, and utilities.
- Command pattern is already clean and stays as-is.
- Aim for single sources of truth and DRY where it improves clarity.

## Proposed changes (ordered by urgency)

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

13. Normalize error handling and results across pipelines

- Why: import/export flows mix thrown errors and `success/error` objects. A consistent `Result` type (or shared error shape) reduces branching and makes errors easier to surface in UI.
- Impact: Low to Medium. Add a small `src/types/result.ts` and refactor `src/composables/useFileHandler.ts` and `src/composables/usePdfExport.ts`.
- Urgency: Low.

14. Consolidate formatting utilities

- Why: `formatBytes` and `formatFileSize` overlap. One formatter with options reduces duplication and makes desktop and mobile consistent.
- Impact: Low. Update imports in `src/components/ExportModal.vue`, `src/components/SourceRail.vue`, and `src/components/mobile/MobileMenuDrawer.vue`.
- Urgency: Low.

15. Unify the import pipeline (validation + image conversion)

- Why: file handling is split between `useFileHandler`, `usePdfManager`, and a duplicate `useConverter`. A single import pipeline makes it extensible (new formats, validation, telemetry).
- Impact: Low to Medium. Create a `src/utils/import-pipeline.ts` or similar and route `useFileHandler` through it; remove `useConverter` or turn it into a thin wrapper.
- Urgency: Low.

16. Add small, focused logic tests

- Why: `parsePageRange`, bookmark auto-generation, and export segmentation are easy to regress. Tests improve confidence without touching UI.
- Impact: Medium. Add unit tests under a new test folder and wire minimal runner config if needed.
- Urgency: Low to Medium.

## Notes

- The plan avoids UI changes but may require small component import updates when utilities are unified.
- If you want, I can turn any of the above into a concrete refactor checklist with tasks per file.
