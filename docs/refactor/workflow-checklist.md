# Flux PDF Refactor Workflow Checklist

Use this checklist when implementing or reviewing features in the refactored architecture.

## 1. Placement

- [x] New code is under `src/domains/*` unless it is shared infrastructure/UI primitive.
- [x] Domain ownership is explicit (`workspace`, `document`, `editor`, `history`, `export`).
- [x] Domain layer folders align with `docs/refactor/domain-layer-matrix.json`.

## 2. Layering

- [x] `ui` depends on `application`/`domain`, not infrastructure adapters.
- [x] `application` orchestrates use-cases and history execution.
- [x] `domain` stays framework-free and deterministic.
- [x] Infrastructure integrations are isolated in `infrastructure`.

## 3. Vue and State

- [x] Composition API + TypeScript (`<script setup lang="ts">`) used by default.
- [x] Pinia store usage is reactivity-safe (`storeToRefs()` where needed).
- [x] Computed values are pure; side effects stay in actions/watchers.

## 4. Commands and History

- [x] Mutations that should be undoable use command execution paths.
- [x] Command payloads are serializable and deserializable.
- [x] Batch/group commands are used for multi-step interactions.
- [x] Core document workflows call use-cases first (`importPdf`, `exportPdf`, `reorderPages`, `updateMetadata`) instead of direct store/command wiring.
- [x] Direct command execution is allowed only with a documented temporary exception approved in architecture docs (currently none).

## 5. Validation

- [x] `npm run type-check`
- [x] `npm run lint`
- [x] `npm run test:unit:run`
- [x] `npm run test:e2e` for UI/interaction changes
- [x] `npm run validate:shadcn` for UI primitive/config changes
- [x] `npm run validate:a11y-overlays` for dialog/sheet/drawer changes
- [x] `npm run validate:architecture` for domain-layer parity, core use-case boundaries, and legacy-path/SFC/JSX guardrails
- [x] Behavior tests added/updated for changed functionality
