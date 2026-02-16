# Refactor Baseline Inventory (2026-02-16)

## Baseline Quality Gates

- `npm.cmd run type-check`: pass
- `npm.cmd run lint`: pass
- `npm.cmd run test:unit:run`: fail (`No test files found`)
- `npm.cmd run test:e2e`: fail (`No tests found`)

Notes:
- Initial sandbox runs hit `spawn EPERM`; final baseline was captured by rerunning commands with elevated permissions.

## Post-Refactor Snapshot (2026-02-16)

### Current Quality Gates

- `npm.cmd run type-check`: pass
- `npm.cmd run lint`: pass
- `npm.cmd run test:unit:run`: pass
- `npm.cmd run test:e2e`: pass
- `npm.cmd run validate:shadcn`: pass
- `npm.cmd run validate:a11y-overlays`: pass
- `npm.cmd run validate:architecture`: pass

### Largest UI Files (Current, Lines)

- `src/domains/editor/ui/components/PagePreviewModal.vue`: 528
- `src/domains/editor/ui/components/export/ExportConfiguration.vue`: 394
- `src/domains/editor/ui/components/DiffModal.vue`: 351
- `src/domains/workspace/ui/views/SettingsView.vue`: 324
- `src/domains/editor/ui/components/PageGrid.vue`: 313
- `src/domains/editor/ui/components/inspector/InspectorStructure.vue`: 311
- `src/domains/editor/ui/components/SourcePageGrid.vue`: 302
- `src/domains/editor/ui/components/inspector/InspectorHistory.vue`: 299
- `src/domains/editor/ui/components/CommandPalette.vue`: 299
- `src/domains/editor/ui/components/PdfThumbnail.vue`: 274

## Architecture Inventory

### Stores (10)

- `src/domains/document/store/document.store.ts`
- `src/domains/document/store/index.ts`
- `src/domains/history/store/history.store.ts`
- `src/domains/history/store/index.ts`
- `src/domains/workspace/store/projects.store.ts`
- `src/domains/workspace/store/settings.store.ts`
- `src/domains/workspace/store/workflows.store.ts`
- `src/domains/workspace/store/index.ts`
- `src/domains/editor/store/ui.store.ts`
- `src/domains/editor/store/index.ts`

### Services / Repositories (2)

- `src/domains/document/application/document.service.ts`
- `src/domains/document/infrastructure/pdf.repository.ts`

### Commands (18)

- `src/domains/history/domain/commands/AddPagesCommand.ts`
- `src/domains/history/domain/commands/AddRedactionCommand.ts`
- `src/domains/history/domain/commands/AddSourceCommand.ts`
- `src/domains/history/domain/commands/BaseCommand.ts`
- `src/domains/history/domain/commands/BatchCommand.ts`
- `src/domains/history/domain/commands/DeletePagesCommand.ts`
- `src/domains/history/domain/commands/DeleteRedactionCommand.ts`
- `src/domains/history/domain/commands/DuplicatePagesCommand.ts`
- `src/domains/history/domain/commands/index.ts`
- `src/domains/history/domain/commands/registry.ts`
- `src/domains/history/domain/commands/RemoveSourceCommand.ts`
- `src/domains/history/domain/commands/ReorderPagesCommand.ts`
- `src/domains/history/domain/commands/ResizePagesCommand.ts`
- `src/domains/history/domain/commands/RotatePagesCommand.ts`
- `src/domains/history/domain/commands/SplitGroupCommand.ts`
- `src/domains/history/domain/commands/types.ts`
- `src/domains/history/domain/commands/UpdateOutlineCommand.ts`
- `src/domains/history/domain/commands/UpdateRedactionCommand.ts`

### Composables (20)

- Composables are split across `src/domains/*/{application,ui}/*` and `src/shared/composables/*`.

## Largest Files (Lines)

- `src/domains/editor/application/useDocumentActions.ts`: 1058
- `src/domains/editor/ui/components/PagePreviewModal.vue`: 652
- `src/domains/export/domain/export.ts`: 612
- `src/domains/workspace/store/projects.store.ts`: 546
- `src/domains/workspace/ui/views/SettingsView.vue`: 531
- `src/domains/document/infrastructure/import.ts`: 467
- `src/domains/document/application/document.service.ts`: 439
- `src/domains/document/store/document.store.ts`: 419
- `src/domains/editor/ui/components/PageGrid.vue`: 417
- `src/domains/editor/ui/components/export/ExportConfiguration.vue`: 394
- `src/domains/editor/ui/components/SourcePageGrid.vue`: 364
- `src/domains/editor/ui/components/DiffModal.vue`: 351
