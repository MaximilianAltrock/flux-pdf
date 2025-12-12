## Flux PDF

Client-side PDF “virtual map” editor built with Vue 3 + Vite.

### Requirements

- Node.js `^20.19.0 || >=22.12.0` (see `package.json`)

### Development

- Install: `npm ci`
- Run dev server: `npm run dev`
- Type-check: `npm run type-check`
- Build: `npm run build-only`
- Lint (auto-fix): `npm run lint`
- Format: `npm run format`

Note (Windows PowerShell): if `npm` script execution is blocked, use `npm.cmd ...`.

### Architecture (high level)

- **Virtual Map model:** document edits rearrange `PageReference` objects (not PDF bytes) in `src/stores/document.ts` and `src/types/index.ts`.
- **Command system (undo/redo):** all mutations are encapsulated as commands in `src/commands/*` and persisted via `src/composables/useCommandManager.ts`.
- **Persistence (IndexedDB/Dexie):**
  - `src/db/db.ts` stores:
    - `files`: source PDF binaries + metadata
    - `session`: workspace state (pages, title, zoom, undo history)
  - Session includes `activeSourceIds` to control which stored files are restored (removing a source removes it from the workspace manifest without necessarily deleting the blob immediately).

### Accessibility

The app targets WCAG 2.2; modal/dialog components use ARIA dialog semantics and focus trapping.
