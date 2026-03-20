import type { ProjectState } from '@/shared/infrastructure/db'
import type { PageEntry, SourceFile } from '@/shared/types'
import type { SerializedCommand } from '@/domains/history/domain/commands'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function collectSourceIdsFromValue(value: unknown, ids: Set<string>): void {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSourceIdsFromValue(item, ids)
    }
    return
  }
  if (!isRecord(value)) return

  const sourceFileId = value.sourceFileId
  if (typeof sourceFileId === 'string') {
    ids.add(sourceFileId)
  }

  const sourceFile = value.sourceFile
  if (isRecord(sourceFile) && typeof sourceFile.id === 'string') {
    ids.add(sourceFile.id)
  }

  for (const child of Object.values(value)) {
    collectSourceIdsFromValue(child, ids)
  }
}

export type GcStateSnapshot = {
  activeSourceIds?: ReadonlyArray<string>
  pages: ReadonlyArray<PageEntry>
  history: ReadonlyArray<SerializedCommand>
}

export function collectReachableSourceIdsFromState(options: {
  activeSourceIds?: ReadonlyArray<string>
  pages: ReadonlyArray<PageEntry>
  history: ReadonlyArray<SerializedCommand>
}): Set<string> {
  const ids = new Set<string>()

  for (const sourceId of options.activeSourceIds ?? []) {
    if (sourceId) ids.add(sourceId)
  }

  for (const page of options.pages) {
    if (!page.isDivider && page.sourceFileId) {
      ids.add(page.sourceFileId)
    }
  }

  for (const command of options.history) {
    collectSourceIdsFromValue(command, ids)
  }

  return ids
}

export function collectReachableSourceIds(options: {
  sources: ReadonlyArray<SourceFile>
  pages: ReadonlyArray<PageEntry>
  history: ReadonlyArray<SerializedCommand>
}): Set<string> {
  return collectReachableSourceIdsFromState({
    activeSourceIds: options.sources.map((source) => source.id),
    pages: options.pages,
    history: options.history,
  })
}

export function collectKeepSourceIds(
  states: ReadonlyArray<ProjectState>,
  currentState?: GcStateSnapshot,
): Set<string> {
  const keepIds = new Set<string>()

  for (const state of states) {
    const ids = collectReachableSourceIdsFromState({
      activeSourceIds: state.activeSourceIds ?? [],
      pages: state.pageMap ?? [],
      history: state.history ?? [],
    })
    for (const id of ids) keepIds.add(id)
  }

  if (currentState) {
    const liveIds = collectReachableSourceIdsFromState({
      activeSourceIds: currentState.activeSourceIds ?? [],
      pages: currentState.pages,
      history: currentState.history,
    })
    for (const id of liveIds) keepIds.add(id)
  }

  return keepIds
}

export function resolveOrphanSourceIds(
  storedKeys: ReadonlyArray<unknown>,
  keepIds: ReadonlySet<string>,
): string[] {
  const storedIds = storedKeys.map((key) => String(key))
  return storedIds.filter((id) => !keepIds.has(id))
}
