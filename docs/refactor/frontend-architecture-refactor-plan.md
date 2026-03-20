# Frontend Architecture Refactor Plan

## Purpose

This document defines the target frontend architecture for the next major refactor so the codebase is reorganized once, with clear ownership boundaries, predictable state flow, and room for future features such as multiple editor tabs or concurrent project sessions.

Execution tracking lives in `docs/refactor/frontend-architecture-execution-plan.md`.

This is not a "split big files" checklist. It is the source of truth for:

- bounded contexts
- runtime scopes
- state ownership
- file ownership and target placement
- migration order
- cleanup guardrails

The goal is to avoid refactor hell by agreeing on the architecture before moving code.

## Goals

- Refactor once around durable boundaries instead of repeatedly reshuffling stores and services.
- Keep the codebase Vue-idiomatic and TypeScript-first.
- Reduce global store coupling and move session state to the correct runtime scope.
- Keep code DRY by eliminating duplicated orchestration, duplicated UI workflow logic, and "god" stores/composables.
- Improve extensibility for future capabilities such as tabs, multiple open project sessions, background jobs, and richer import/export pipelines.

## Non-Goals

- Do not rewrite the whole UI in one pass.
- Do not introduce backend-style DDD ceremony where it does not buy clarity.
- Do not split files only for symmetry.
- Do not keep legacy compatibility layers longer than needed after the migration is stable.

## Architectural Principles

### 1. Bounded context over folder symmetry

Code should be grouped by actual product capability and ownership, not just by technical type or the current store layout.

### 2. Runtime scope decides state location

- App-global state belongs in Pinia only when it is truly shared across routes and sessions.
- Route-scoped or tab-scoped state belongs in a session object provided with `provide` / `inject`.
- One active project session must not be modeled as a permanent app-global singleton.

### 3. Vue-idiomatic structure

- Use Composition API and `<script setup lang="ts">`.
- Keep UI components thin; move orchestration into composables or application services.
- Prefer `computed` for derivation and explicit actions/use-cases for mutations.
- Use typed `InjectionKey`s for session contexts.
- Provide session context synchronously during component setup; do not `provide()` after `await` or inside callbacks.
- Avoid deep watchers over large document structures unless there is no cheaper signal.

### 4. Explicit layers inside a bounded context

Each domain may use some or all of these layers:

- `domain`: pure rules, invariants, transformations, domain types
- `application`: use-cases, orchestration, coordinators
- `infrastructure`: Dexie, pdf.js, workers, browser adapters
- `session`: route-scoped or tab-scoped reactive runtime state
- `ui`: Vue components and UI-only composables

Not every domain needs every layer, but ownership must be explicit.

### 5. No cross-domain store grabbing

Domains should not directly depend on another domain's store as their primary integration mechanism. Use:

- application services
- session contracts
- repositories/adapters
- small typed interfaces

### 6. Session lifetime must be explicit

Any session runtime created outside a component's own setup lifecycle must own its own reactive scope.

- `createProjectSession()` must create a detached `effectScope(true)`.
- The session must expose `dispose()` and stop the scope there.
- Watchers/computed side effects created by session-level services must run inside that scope or return explicit stop handles.
- If a session is provided from a component, the provider must connect component teardown to `session.dispose()`.

This is required to avoid leaked watchers and computed effects when switching routes now and when supporting tabs later.

### 7. Use `shallowRef` and `markRaw` selectively, not blindly

Use `shallowRef` for:

- external library instances
- worker references
- pdf.js or other opaque runtime objects
- large immutable or replacement-based datasets

Use `markRaw` for third-party instances that should never be proxied.

Do not blanket-convert mutable editor state to `shallowRef` if the code mutates nested structures in place. In this codebase that caution applies to:

- page collections
- source registries
- outline trees
- selection state with mutable `Set`s

Those structures should move to `shallowRef` only if the session runtime also adopts replacement semantics or explicit `triggerRef`/version bump discipline.

## Target Top-Level Domains

The current domain split is close, but it is not aligned with runtime scope. The target architecture is:

### Workspace

Owns the project catalog and workspace surfaces:

- recent projects
- trashed projects
- project summaries and thumbnails
- dashboard and trash views

Does not own the active editor runtime.

### Project Session

New top-level domain. Owns the runtime for one opened project:

- active project id and meta
- hydration and load lifecycle
- autosave lifecycle
- session disposal
- glue between document, history, import/export operations, and editor session UI state

This is route-scoped today and must be tab-scoped in the future.

### Document

Owns the pure editable project content:

- sources
- pages
- metadata
- security
- outline
- pure document rules and transformations

### Import

New top-level domain. Owns file ingestion:

- file intake
- pdf.js parsing
- source creation
- metadata extraction
- imported outline creation
- import progress and errors

### Export

Owns export and publishing:

- export options
- page range parsing
- export progress
- PDF generation and compression
- output naming

### History

Owns command history and undo/redo semantics:

- command types and serialization
- command execution and replay
- history session state

### Settings

New top-level domain. Owns user preferences and storage/admin preferences:

- app preferences
- editor defaults
- export defaults
- theme and storage administration UI

### Workflows

New top-level domain. Owns workflow templates/runs and should not stay nested under workspace.

### Editor

Becomes a UI shell rather than a business domain:

- layouts
- editor view assembly
- UI interaction adapters
- keyboard shortcuts
- mobile/desktop interaction helpers

## Target Runtime Scopes

| Scope | Ownership | Examples |
| --- | --- | --- |
| App-global | Pinia or app-level singleton composables | settings, workspace catalog summaries, workflow list |
| Route-scoped today / tab-scoped later | provided session object | active project session, document state, history state, editor UI session state, import/export operation state |
| Pure stateless domain logic | plain TypeScript modules | outline transforms, filename rules, command definitions, storage GC rules |
| Infrastructure | adapter/repository modules | Dexie repositories, pdf.js loading, worker wrappers |

## Domain Decisions and File Ownership

This section defines the target owner for the current files. "Keep" means the file remains in the same bounded context, not necessarily the same path. "Move" means the file should change domains. "Replace" means the current file should be removed after its responsibilities are migrated.

## Document Domain

### Keep in `document`

These files represent the actual editable document model or document use-cases:

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/document/application/use-cases/add-pages*.ts` | `document/application/use-cases` | Keep | Pure document mutation use-cases |
| `src/domains/document/application/use-cases/delete-pages.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/duplicate-pages.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/remove-source.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/reorder-pages.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/resize-pages.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/rotate-pages.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/split-group.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/update-metadata.ts` | `document/application/use-cases` | Keep | Document metadata rule application |
| `src/domains/document/application/use-cases/update-outline-tree.ts` | `document/application/use-cases` | Keep | Document outline mutation |
| `src/domains/document/application/use-cases/add-redaction.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/delete-redaction.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/delete-redactions.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/update-redaction.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/add-source.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/application/use-cases/add-sources.ts` | `document/application/use-cases` | Keep | Core document mutation |
| `src/domains/document/domain/outline.ts` | `document/domain` | Keep | Pure outline domain logic |
| `src/domains/document/domain/types.ts` | `document/domain` | Keep | Domain types |

### Move out of `document`

These files are not document-model concerns and should move:

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/document/application/document-import.service.ts` | `import/application` | Move | File ingestion is its own workflow and error model |
| `src/domains/document/application/document-export.service.ts` | `export/application` | Move | Export pipeline is not document-model ownership |
| `src/domains/document/application/document-service.shared.ts` | `project-session/application` plus `import` / `export` contracts | Split | Current shared contract mixes session and operation concerns |
| `src/domains/document/application/document.service.ts` | remove | Replace | Transitional facade only; target is separate import/export entry points |
| `src/domains/document/application/use-cases/import-pdf.ts` | `import/application/use-cases` | Move | Import is not a document use-case |
| `src/domains/document/application/use-cases/export-pdf.ts` | `export/application/use-cases` | Move | Export is not a document use-case |
| `src/domains/document/infrastructure/import.ts` | `import/infrastructure` | Move | pdf.js ingestion belongs to import |
| `src/domains/document/infrastructure/pdf.repository.ts` | `shared/infrastructure/pdf` | Move | Shared technical adapter used by import, export, thumbnails, preview |
| `src/domains/document/domain/errors.ts` | split between `document`, `import`, `export` | Split | Current error catalog mixes multiple bounded contexts |
| `src/domains/document/domain/project.ts` | `project-session/domain/project-snapshot.ts` | Move | Project snapshot/persistence model is not the pure document domain |
| `src/domains/document/domain/storage-gc.ts` | `project-session/domain` or `shared/storage` | Move | GC rules are persistence/session concerns |

### Reclassify document-facing composables

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/document/application/composables/usePageRedactionStats.ts` | `document/application/selectors` or `editor/ui/composables` | Reclassify | Derived read model, not business orchestration |
| `src/domains/document/application/composables/useSourceDropHandlers.ts` | `editor/application/interactions` | Move | Drag/drop is UI interaction orchestration |
| `src/domains/document/application/composables/useSourcePageSelection.ts` | `editor/ui/composables` | Move | UI selection helper |
| `src/domains/document/application/composables/useThumbnailRenderer.ts` | `shared/infrastructure/pdf` or `workspace/application/thumbnail` | Move | Shared PDF rendering adapter |

### Replace the document store

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/document/store/document.store.ts` | `project-session/session/document-state.ts` | Replace | Active document state is session-scoped, not app-global |

The replacement must expose a typed session contract and can use Pinia only as a temporary adapter during migration.

## Import Domain

Create a new top-level `import` domain with this target responsibility:

- import services and use-cases
- progress and error state for the active session
- pdf.js loading/parsing
- metadata extraction and outline extraction
- import UI surfaces if dedicated import UI is added later

Initial file intake for this domain comes from:

- `src/domains/document/application/document-import.service.ts`
- `src/domains/document/application/use-cases/import-pdf.ts`
- `src/domains/document/infrastructure/import.ts`
- the import-related part of `src/domains/editor/application/actions/file-export-actions.ts`
- `importJob` state currently in `src/domains/editor/store/ui.store.ts`

Target structure:

```text
src/domains/import/
  application/
  infrastructure/
  session/
  ui/
```

## Export Domain

### Keep but split internally

Export is already a real bounded context, but it is too large in a few files.

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/export/domain/export.ts` | `export/domain/*` | Split | 700+ lines; contains too many responsibilities |
| `src/domains/export/application/usePdfCompression.ts` | `export/application` and `export/infrastructure` | Split | Progress orchestration and worker adapter should be separate |
| `src/domains/export/infrastructure/compression-worker.ts` | `export/infrastructure` | Keep | Worker boundary is correct |

Recommended internal split for `export/domain/export.ts`:

- export plan/build manifest logic
- filename and metadata rules
- page range selection rules
- size estimation
- pdf-lib writing/rendering helpers

### Move export runtime state out of a global store

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/export/store/export.store.ts` | `export/session/export-operation.state.ts` | Replace | Export state is session-scoped, not app-global |

### Move export UI to the export bounded context

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/editor/ui/components/export/*` | `export/ui/components` | Move | Export UI belongs with export workflows |
| `src/domains/editor/ui/components/mobile/MobileExportSheet.vue` | `export/ui/components/mobile` | Move | Export UI belongs with export workflows |
| `src/domains/editor/ui/components/mobile/export/*` | `export/ui/components/mobile` | Move | Export UI belongs with export workflows |
| export-related logic in `src/domains/editor/application/actions/file-export-actions.ts` | `export/application` plus editor adapters | Split | Current file mixes import, export, UI, and mobile behavior |

## History Domain

### Keep command definitions and execution

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/history/domain/commands/*` | `history/domain/commands` | Keep | Correct domain placement |
| `src/domains/history/application/execute-command.ts` | `history/application` | Keep | Correct use-case layer |
| `src/domains/history/application/execute-command-batch.ts` | `history/application` | Keep | Correct use-case layer |
| `src/domains/history/application/command-executor.ts` | `history/application` | Keep but slim | Execution engine belongs here |

### Replace the history store with a session object

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/history/store/history.store.ts` | `history/session/create-history-session.ts` | Replace | Undo/redo state is per project session, not app-global |

The history domain remains top-level, but its live state becomes route-scoped/tab-scoped.

## Workspace Domain

### Keep in `workspace`

These files still belong to the workspace catalog/dashboard bounded context:

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/workspace/ui/views/DashboardView.vue` | `workspace/ui/views` | Keep | Workspace catalog UI |
| `src/domains/workspace/ui/views/TrashView.vue` | `workspace/ui/views` | Keep | Workspace catalog UI |
| `src/domains/workspace/ui/layouts/DashboardLayout.vue` | `workspace/ui/layouts` | Keep | Workspace shell |
| `src/domains/workspace/ui/components/dashboard/*` | `workspace/ui/components/dashboard` | Keep | Workspace UI |
| `src/domains/workspace/application/useProjectThumbnailUrls.ts` | `workspace/application` | Keep | Workspace thumbnail URL lifecycle |
| `src/domains/workspace/application/project-thumbnail.service.ts` | `workspace/application` | Keep | Workspace presentation/service concern |

### Move out of `workspace`

These files are currently in workspace but are actually active-session, settings, or workflows concerns:

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/workspace/application/project-authoring.service.ts` | `project-session/application` | Move | Builds snapshots from the active session |
| `src/domains/workspace/application/project-autosave.service.ts` | `project-session/application` | Move | Autosave is per active session |
| `src/domains/workspace/application/project-hydration.service.ts` | `project-session/application` | Move | Hydrating a live project is session orchestration |
| `src/domains/workspace/application/project-lifecycle.service.ts` | `project-session/application` | Move | Loading/switching/trashing active projects is session orchestration |
| `src/domains/workspace/application/project-route-sync.ts` | `project-session/ui` or `project-session/application` | Move | Route/session coordination is not catalog logic |
| `src/domains/workspace/application/project-session.service.ts` | `project-session/domain` or `project-session/application` | Move | Session rule ownership |
| `src/domains/workspace/application/project-source-gc.service.ts` | `project-session/application` | Move | GC of active project references is session/persistence logic |
| `src/domains/workspace/application/project-state.service.ts` | `project-session/session` | Move | Active project state controller |
| `src/domains/workspace/application/project-storage-gc.ts` | `project-session/domain` or `shared/storage` | Move | Storage reachability logic is not workspace UI/catalog logic |
| `src/domains/workspace/application/project-persistence.service.ts` | split between `workspace` and `project-session` repositories | Split | Catalog queries and full snapshot persistence are different repositories |
| `src/domains/workspace/store/projects.store.ts` | `workspace/store/workspace-catalog.store.ts` plus `project-session` provider | Split/Replace | Current store mixes catalog and active-session runtime |

### Extract settings and workflows from workspace

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/workspace/store/settings.store.ts` | `settings/store/settings.store.ts` | Move | Settings are app-global, not workspace catalog |
| `src/domains/workspace/application/useAppPreferences.ts` | `settings/application` | Move | Settings concern |
| `src/domains/workspace/application/useThemeToggle.ts` | `settings/application` | Move | Settings concern |
| `src/domains/workspace/ui/views/SettingsView.vue` | `settings/ui/views` | Move | Settings screen is not a workspace dashboard concern |
| `src/domains/workspace/ui/components/settings/*` | `settings/ui/components` | Move | Settings UI |
| `src/domains/workspace/store/workflows.store.ts` | `workflows/store/workflows.store.ts` | Move | Separate product capability |
| `src/domains/workspace/application/workflow.service.ts` | `workflows/application` | Move | Separate product capability |
| `src/domains/workspace/application/useWorkflowRunner.ts` | `workflows/application` | Move | Separate product capability |
| `src/domains/workspace/ui/views/WorkflowsView.vue` | `workflows/ui/views` | Move | Separate product capability |
| `src/domains/workspace/ui/components/workflows/*` | `workflows/ui/components` | Move | Separate product capability |

### Reclassify storage administration

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/workspace/application/useStorageGC.ts` | `settings/application/storage-admin` or `shared/storage` | Move | "Clear app data" is settings/admin behavior, not workspace catalog behavior |

## Project Session Domain

Create a new top-level `project-session` domain as the runtime owner for one opened project.

This is the key architectural addition. Without it, the app will keep forcing route-local behavior into global stores.

Target responsibilities:

- create/destroy one project session
- own the active project id/meta
- coordinate load, hydrate, persist, autosave
- bind document state, history state, import/export operation state, and editor session UI state
- expose typed session commands and selectors to the editor shell
- expose `dispose()` and own the lifetime of its reactive scope

Target structure:

```text
src/domains/project-session/
  application/
  domain/
  session/
    create-project-session.ts
    provide-project-session.ts
  infrastructure/
```

Future tabs should create one `ProjectSession` instance per tab instead of relying on global singletons.

## Settings Domain

Create a new top-level `settings` domain.

It should own:

- persistent user preferences
- theme preferences
- editor defaults
- export defaults
- storage administration UI

This domain is a correct Pinia candidate because it is app-global and not tied to one open project.

## Workflows Domain

Create a new top-level `workflows` domain.

It should own:

- workflow definitions
- workflow CRUD
- workflow run orchestration
- workflow UI

This is a separate product feature and should not stay under workspace.

## Editor Domain

### Re-scope `editor` to a UI shell

The editor domain currently mixes UI shell concerns, action orchestration, and session state. Its target role is:

- editor layouts
- top-level editor view assembly
- keyboard shortcut bindings
- mobile/desktop interaction helpers
- UI adapters that call into session/application use-cases

### Move or split current editor files

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/domains/editor/store/ui.store.ts` | `project-session/session/editor-ui.state.ts` | Replace | Editor UI state is tied to the active session |
| `src/domains/editor/application/useDocumentActions.ts` | split into domain-specific action composables | Replace | Current file is a god action facade |
| `src/domains/editor/application/actions/project-actions.ts` | `project-session/application` plus editor adapters | Split | Project lifecycle commands belong to the session/application layer |
| `src/domains/editor/application/actions/file-export-actions.ts` | split between `import`, `export`, and editor adapters | Split | Current file mixes multiple workflows |
| `src/domains/editor/application/actions/page-actions.ts` | keep as thin editor adapter over document/history use-cases | Slim | UI command assembly is valid, but document mutation must stay below |
| `src/domains/editor/application/actions/metadata-actions.ts` | keep as thin editor adapter over document use-cases | Slim | UI command assembly is valid |
| `src/domains/editor/application/actions/outline-actions.ts` | keep as thin editor adapter over document use-cases | Slim | UI command assembly is valid |
| `src/domains/editor/application/actions/command-actions.ts` | keep in editor/application | Keep but slim | Command palette actions are editor shell behavior |
| `src/domains/editor/application/useKeyboardShortcuts.ts` | `editor/application` | Keep | Editor shell concern |
| `src/domains/editor/application/useEditorActionAvailability.ts` | `editor/application` | Keep | Editor shell concern |
| `src/domains/editor/application/useMobileActionRegistry.ts` | `editor/application` | Keep | Editor shell concern |
| `src/domains/editor/application/usePreflight.ts` | split between `document/application/preflight` and `editor/application` provider wrapper | Split | Rules are document analysis; provider wiring is editor/session concern |
| `src/domains/editor/ui/views/EditorView.vue` | `editor/ui/views` plus project-session provider wiring | Keep | Editor shell root |
| `src/domains/editor/ui/components/*` | `editor/ui/components` | Keep | UI stays in editor unless it belongs to a more specific bounded context |

### Export UI components that should move

These should move out of editor UI and into export UI:

- `src/domains/editor/ui/components/export/*`
- `src/domains/editor/ui/components/mobile/MobileExportSheet.vue`
- `src/domains/editor/ui/components/mobile/export/*`

## Shared and Infrastructure Boundaries

The `shared` layer should only contain cross-cutting primitives and infrastructure adapters that do not belong to one business domain.

Allowed in `shared`:

- low-level infrastructure
- app-wide constants
- generic UI primitives
- generic utilities
- shared PDF technical adapters if they are truly used by multiple domains

Not allowed in `shared`:

- business workflows
- domain-specific orchestration
- pseudo-domains hidden as helpers

Recommended technical extractions:

- a shared PDF repository/gateway
- shared storage administration primitives
- generic logger and result/error helpers

## App Assembly Files

The current app assembly layer also needs explicit ownership decisions because it is where the existing global-store coupling is wired together.

| Current file(s) | Target owner | Action | Reason |
| --- | --- | --- | --- |
| `src/app/composition-root.ts` | `editor/ui` plus `project-session/session` assembly | Replace | Current root assembles several app-global stores for what should become one injected session |
| `src/app/document-service.bindings.ts` | split into `import`, `export`, and `project-session` assembly helpers | Replace | Current binding file reinforces the old document-service facade and global-store coupling |

Rules for the app layer:

- The app layer may assemble domains, but it must not become a second business-logic layer.
- The editor route should assemble a `ProjectSession` and provide it downward.
- Domain entry points should be explicit and typed; avoid one giant root service facade.
- Barrel files such as `index.ts` should be updated only after domain ownership is stable, not used as the primary migration mechanism.

## What Stays in Pinia

Keep Pinia for app-global durable state:

- settings
- workspace catalog summary state if needed
- workflow list state if needed

Do not keep these as app-global Pinia stores long term:

- active project runtime
- document state
- history stack
- editor session UI state
- import/export job state for the active project

## What Becomes Session-Scoped

The `ProjectSession` must own:

- active project id/meta
- document state
- history state
- editor session UI state
- import operation state
- export operation state
- autosave and hydration lifecycle

Tabs become straightforward once this exists:

- the shell owns an array of session descriptors
- each tab owns one `ProjectSession`
- tab switching changes the active injected session instead of swapping global store state

## DRY and Cleanup Rules for the Refactor

- Do not duplicate mobile and desktop workflow logic unless the UI genuinely diverges.
- Do not keep "temporary" facades for more than one migration phase.
- Do not let UI components call Dexie, pdf.js, or worker code directly.
- Do not let one domain import another domain's store.
- Do not keep both old and new state ownership active for long.
- Prefer extracting pure domain helpers before extracting more services.
- Large files should only be split when the split creates a real ownership boundary.

## Recommended Migration Order

### Phase 0: Freeze the target architecture

- Approve this domain map.
- Approve naming for new domains: `project-session`, `import`, `settings`, `workflows`.
- Agree that editor becomes primarily a UI shell.

### Phase 1: Create new top-level domains without changing runtime behavior

- Create empty domain shells for `project-session`, `import`, `settings`, and `workflows`.
- Move settings and workflows first because they are lower risk and reduce noise in `workspace`.
- Move export UI components into `export/ui`.

### Phase 2: Introduce the project session abstraction

- Add `createProjectSession()` and `provideProjectSession()`.
- Define the session contract:
  - document state
  - history state
  - editor UI session state
  - import/export operation state
  - project lifecycle commands
- Keep adapter shims to the old stores temporarily so the UI can migrate incrementally.

### Phase 3: Move import and export operation state

- Move `importJob` out of editor UI state into the import session state.
- Move export modal/job state out of the global export store into export session state.
- Split `file-export-actions.ts` into import and export action modules plus thin editor UI adapters.

### Phase 4: Replace document, history, and editor UI global stores

- Replace `document.store.ts` with session-scoped `document-state`.
- Replace `history.store.ts` with session-scoped history runtime.
- Replace `ui.store.ts` with session-scoped editor UI state.
- Keep compatibility wrappers only as short-lived migration adapters.

### Phase 5: Split workspace catalog from project session lifecycle

- Reduce workspace to catalog/dashboard/trash ownership only.
- Move lifecycle, hydration, autosave, authoring, and persistence orchestration into `project-session`.
- Split project persistence into catalog repository and snapshot repository.

### Phase 6: Cleanup and harden boundaries

- Remove temporary facades and adapters.
- Split oversized files that are still violating ownership:
  - `export/domain/export.ts`
  - `useDocumentActions.ts`
  - any remaining mixed workflow files
- Ensure imports follow the new boundaries.

## Acceptance Criteria

The refactor is complete when:

- one active project is represented by one `ProjectSession`
- no domain other than settings/workspace/workflows relies on app-global Pinia for route-local runtime state
- import and export are first-class bounded contexts
- workspace owns catalog concerns only
- editor acts as UI shell, not a mixed business domain
- settings and workflows are no longer nested under workspace
- document owns document model concerns only
- history live state is session-scoped
- the codebase can support multiple project sessions without redesigning global state

## Vue and TypeScript Best Practices to Enforce During the Refactor

- Use Composition API and `<script setup lang="ts">` in Vue components.
- Use `InjectionKey`-based typed session accessors.
- Use explicit interfaces/types for session contracts and repository contracts.
- Prefer `computed` selectors over mutation-based watchers for derived state.
- Keep UI props small and typed.
- Use `storeToRefs` only where Pinia remains appropriate.
- Keep large mutable graphs behind explicit action functions, not ad hoc object mutation from components.
- Avoid implicit singletons unless the scope is truly app-global.
- Use `effectScope(true)` for long-lived session runtimes and expose `dispose()` on them.
- Call `provide()` synchronously in setup and connect session disposal with component teardown.
- Use `shallowRef` for large replacement-based or opaque values and `markRaw` for third-party instances that should never be proxied.
- Do not replace mutable document collections with `shallowRef` unless update semantics are explicitly designed for it.

## Final Decision Summary

The target architecture is:

- DDD-lite / clean-architecture-lite boundaries
- feature-oriented top-level domains
- route-scoped/tab-scoped `ProjectSession`
- document, import, export, history, workspace, settings, workflows as distinct ownership areas
- editor reduced to a UI shell

This is the architecture that best supports long-term maintainability, extensibility, and a one-time refactor with clean boundaries.
