# Flux PDF Refactor Workflow Checklist

Use this checklist when implementing or reviewing features in the refactored architecture.

## 1. Placement

- [ ] New code is under `src/domains/*` unless it is shared infrastructure/UI primitive.
- [ ] Domain ownership is explicit (`workspace`, `document`, `editor`, `history`, `export`).

## 2. Layering

- [ ] `ui` depends on `application`/`domain`, not infrastructure adapters.
- [ ] `application` orchestrates use-cases and history execution.
- [ ] `domain` stays framework-free and deterministic.
- [ ] Infrastructure integrations are isolated in `infrastructure`.

## 3. Vue and State

- [ ] Composition API + TypeScript (`<script setup lang="ts">`) used by default.
- [ ] Pinia store usage is reactivity-safe (`storeToRefs()` where needed).
- [ ] Computed values are pure; side effects stay in actions/watchers.

## 4. Commands and History

- [ ] Mutations that should be undoable use command execution paths.
- [ ] Command payloads are serializable and deserializable.
- [ ] Batch/group commands are used for multi-step interactions.

## 5. Validation

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Behavior tests added/updated for changed functionality
