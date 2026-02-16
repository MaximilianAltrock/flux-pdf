# Flux PDF Refactor Remediation Plan (2026-02-16)

This plan addresses the gaps found during verification of `Refactor-Plan.md` and `Refactor-Execution-Plan.md`.

## Verified Gaps To Address

1. Domain/layer parity is inconsistent with the current execution checklist.
2. `export` domain has no `store`, despite being listed as a completed split state domain.
3. Document use-cases exist but are not used in runtime editor orchestration paths.
4. `src/domains/editor/application/useDocumentActions.ts` remains a large monolith.
5. Completion docs claim full completion while several items are only partially implemented.
6. Branch protection is scripted and documented, but remote verification evidence is not recorded.

## Phase 0 - Scope Alignment and Architecture Contract

### Goal

Make the target architecture explicit so validation is unambiguous.

### Checklist

- [x] Define required layer matrix per domain (`workspace`, `document`, `editor`, `history`, `export`) in one source of truth.
- [x] Decide whether `ui`/`store` are mandatory for all domains or optional by domain.
- [x] Update ADR + execution docs to match the chosen matrix.
- [x] Add a validation script for domain structure parity against the matrix.

### Exit Criteria

- [x] Architecture matrix is documented and versioned.
- [x] CI fails when domain folder structure diverges from the matrix.

## Phase 1 - Export Domain State Model

### Goal

Resolve the mismatch between planned and implemented export state architecture.

### Checklist

- [x] Choose one path (selected Path A).
- [x] Path A: introduce `src/domains/export/store` and migrate export UI state there.
- [x] Path B was explicitly not selected.
- [x] Ensure no hidden export state remains scattered across unrelated stores.
- [x] Add/adjust tests for the final export state ownership.

### Exit Criteria

- [x] Export state ownership is explicit, test-covered, and reflected in docs.

## Phase 2 - Runtime Use-Case Adoption

### Goal

Route editor workflows through application use-cases instead of ad-hoc direct store/command orchestration.

### Checklist

- [x] Wire `importPdf` use-case into the editor import flow.
- [x] Wire `exportPdf` use-case into export flow.
- [x] Wire `reorderPages` use-case into drag/reorder flow.
- [x] Wire `updateMetadata` use-case into metadata edit flow.
- [x] Define where direct command execution is still allowed and document exceptions.
- [x] Remove duplicate runtime logic once use-cases are the primary path.

### Exit Criteria

- [x] Runtime editor workflows call use-cases (not only tests).
- [x] Behavior remains unchanged for desktop/mobile smoke journeys.

## Phase 3 - `useDocumentActions` Decomposition

### Goal

Split orchestration into focused modules with clear boundaries.

### Checklist

- [x] Extract action groups into focused modules:
- [x] file/import actions
- [x] export/share actions
- [x] page selection/mutation actions
- [x] redaction actions
- [x] outline actions
- [x] metadata/security actions
- [x] Keep one thin composition root that assembles dependencies and provides action context.
- [x] Eliminate direct infrastructure imports from UI-facing modules when avoidable.
- [x] Add unit tests for extracted modules where logic moved.

### Exit Criteria

- [x] No single editor action module is a mega-file.
- [x] Responsibilities are separated and easier to test in isolation.

## Phase 4 - Quality Gates and Regression Safety

### Goal

Lock in new architecture behavior with enforceable checks.

### Checklist

- [x] Add architecture rule/tests that detect runtime bypass of use-cases for core document workflows.
- [x] Add targeted tests around command/use-case integration boundaries.
- [x] Keep smoke coverage for:
- [x] desktop flow (`import -> reorder -> metadata -> undo/redo -> export`)
- [x] mobile core action navigation flow
- [x] Ensure `validate:architecture` includes all new architectural guardrails.

### Exit Criteria

- [x] CI blocks regressions in both architecture and behavior paths.

## Phase 5 - Documentation Truthfulness and Closeout

### Goal

Bring planning documents in sync with actual implementation state.

### Checklist

- [x] Update `Refactor-Execution-Plan.md` status from blanket complete to accurate item-level state.
- [x] Refresh `docs/refactor/baseline-inventory.md` with current file sizes and counts.
- [ ] Record branch protection verification evidence (date, repo, required checks observed).
- [x] Add a short "known exceptions" section for intentional deviations.

### Exit Criteria

- [ ] Docs reflect reality and can be trusted for onboarding/reviews.

### Known Exceptions

- Branch protection verification evidence is pending because remote repo/token verification was not performed in this workspace session.

## Suggested Execution Order

1. Phase 0 (contract first)
2. Phase 1 (export state decision)
3. Phase 2 (use-case wiring)
4. Phase 3 (action decomposition)
5. Phase 4 (guardrails/tests)
6. Phase 5 (docs closeout)

## Definition of Done

- [x] Architecture contract and folder/state rules are explicit and enforced.
- [x] Core editor workflows use application use-cases in runtime.
- [x] Editor action orchestration is decomposed into focused modules.
- [x] CI and tests protect command/use-case behavior and mobile/desktop flows.
- [ ] Refactor documents are accurate and no longer overstate completion.
