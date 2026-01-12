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

### Migration guide (session + commands)

Session and command history are stored in IndexedDB, so schema changes must be migrated to avoid breaking existing users.

**Command schema changes**

- Version lives in `src/commands/types.ts` as `COMMAND_SCHEMA_VERSION`.
- Migrations live in `src/commands/migrations.ts`.
- `commandRegistry.deserialize(...)` automatically runs migrations; callers do not need to do anything.

When you change a command payload:
1) Bump `COMMAND_SCHEMA_VERSION`.
2) Add a `case` in `migrateSerializedCommand(...)` to map old payloads to the new shape.
3) Update the command `deserialize(...)` to expect the migrated shape.
4) Add or update tests in `tests/commands/*.spec.ts`.

Example (rename `payload.foo` -> `payload.bar`):

```ts
// src/commands/migrations.ts
export function migrateSerializedCommand(command: SerializedCommandRecord): SerializedCommand {
  const version = typeof command.version === 'number' ? command.version : 1

  switch (version) {
    case 1: {
      const payload = command.payload as { id: string; foo?: string; bar?: string }
      const bar = payload.bar ?? payload.foo ?? ''
      return { ...command, version: 2, payload: { ...payload, bar } }
    }
    default:
      return { ...command, version }
  }
}
```

**Session schema changes**

- Version lives in `src/domain/document/session.ts` as `SESSION_SCHEMA_VERSION`.
- Migrations live in `migrateSessionState(...)` (same file).
- `loadSession()` automatically migrates and re-saves the session.

When you change the session shape:
1) Bump `SESSION_SCHEMA_VERSION`.
2) Add a `case` in `migrateSessionState(...)` with defaults or renames.
3) Add or update tests in `tests/domain/session.spec.ts`.
4) Only bump Dexie DB version in `src/db/db.ts` if IndexedDB store/index definitions change.

**Validation**

- Run `npm run test:unit:run` to exercise migration tests.

### Accessibility

The app targets WCAG 2.2; modal/dialog components use ARIA dialog semantics and focus trapping.
