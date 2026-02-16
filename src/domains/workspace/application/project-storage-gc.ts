import { collectReachableSourceIdsFromState } from '@/domains/document/domain/storage-gc'
import type { ProjectState } from '@/shared/infrastructure/db'
import type { PageEntry } from '@/shared/types'
import type { SerializedCommand } from '@/domains/history/domain/commands/types'

export type GcStateSnapshot = {
  activeSourceIds?: ReadonlyArray<string>
  pages: ReadonlyArray<PageEntry>
  history: ReadonlyArray<SerializedCommand>
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

