# Refactor Baseline Inventory (2026-02-16)

## Baseline Quality Gates

- `npm.cmd run type-check`: pass
- `npm.cmd run lint`: pass
- `npm.cmd run test:unit:run`: fail (`No test files found`)
- `npm.cmd run test:e2e`: fail (`No tests found`)

Notes:
- Initial sandbox runs hit `spawn EPERM`; final baseline was captured by rerunning commands with elevated permissions.

## Architecture Inventory

### Stores (10)

- `src/domains/document/store/document.store.ts`
- `src/domains/document/store/index.ts`
- `src/domains/history/store/history.store.ts`
- `src/domains/history/store/index.ts`
- `src/stores/document.ts` (compat wrapper)
- `src/stores/history.ts` (compat wrapper)
- `src/stores/projects.ts`
- `src/stores/settings.ts`
- `src/stores/ui.ts`
- `src/stores/workflows.ts`

### Services / Repositories (4)

- `src/domains/document/application/document.service.ts`
- `src/domains/document/infrastructure/pdf.repository.ts`
- `src/services/documentService.ts` (compat wrapper)
- `src/services/pdfRepository.ts` (compat wrapper)

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

- Current composables under `src/composables/*` plus new domain composables under `src/domains/document/application/composables/*`.

## Largest Files (Lines)

- `src/composables/useDocumentActions.ts`: 1058
- `src/components/editor/PagePreviewModal.vue`: 652
- `src/domain/document/export.ts`: 612
- `src/stores/projects.ts`: 546
- `src/views/SettingsView.vue`: 531
- `src/domain/document/import.ts`: 467
- `src/domains/document/application/document.service.ts`: 439
- `src/domains/document/store/document.store.ts`: 419
- `src/components/editor/PageGrid.vue`: 417
- `src/components/editor/export/ExportConfiguration.vue`: 394
- `src/components/editor/SourcePageGrid.vue`: 364
- `src/components/editor/DiffModal.vue`: 351
