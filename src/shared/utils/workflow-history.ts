import { CommandType, type Command, type SerializedCommand } from '@/domains/history/domain/commands'
import { WorkflowActionType } from '@/domains/workspace/domain/workflow.actions'
import type { WorkflowStep } from '@/shared/types/workflow'

export interface WorkflowCandidateStep {
  commandId: string
  label: string
  commandType: string
  params: Record<string, unknown>
  includeByDefault: boolean
  sourceCommandType: string
}

export interface WorkflowCandidateBuildResult {
  candidates: WorkflowCandidateStep[]
  unsupportedCount: number
}

interface WorkflowPageTrackerState {
  pageIds: string[]
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toCommandId(serialized: SerializedCommand): string {
  const payload = toRecord(serialized.payload)
  const id = payload.id
  if (typeof id === 'string' && id.length > 0) return id
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `workflow-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function setEquals(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

function removePageIds(state: WorkflowPageTrackerState, idsToRemove: ReadonlyArray<string>): void {
  if (idsToRemove.length === 0 || state.pageIds.length === 0) return
  const removeSet = new Set(idsToRemove)
  state.pageIds = state.pageIds.filter((id) => !removeSet.has(id))
}

function applyAddPages(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  const payload = toRecord(serialized.payload)
  const pages = Array.isArray(payload.pages) ? payload.pages : []
  const pageIds: string[] = []

  for (const page of pages) {
    if (!page || typeof page !== 'object') continue
    const id = (page as { id?: unknown }).id
    const isDivider = (page as { isDivider?: unknown }).isDivider
    if (typeof id !== 'string' || id.length === 0) continue
    if (isDivider === true) continue
    pageIds.push(id)
  }

  if (pageIds.length > 0) {
    state.pageIds = [...state.pageIds, ...pageIds]
  }
}

function applyDeletePages(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  const payload = toRecord(serialized.payload)
  const ids = toStringArray(payload.pageIds)
  removePageIds(state, ids)
}

function applyDuplicatePages(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  const payload = toRecord(serialized.payload)
  const sourcePageIds = toStringArray(payload.sourcePageIds)
  const createdPageIds = toStringArray(payload.createdPageIds)

  if (createdPageIds.length === 0) return

  const nextPageIds = [...state.pageIds]
  const inserted = new Set<string>()

  for (let i = 0; i < sourcePageIds.length; i++) {
    const sourceId = sourcePageIds[i]
    const createdId = createdPageIds[i]
    if (!sourceId || !createdId) continue

    const sourceIndex = nextPageIds.indexOf(sourceId)
    if (sourceIndex < 0) continue
    nextPageIds.splice(sourceIndex + 1, 0, createdId)
    inserted.add(createdId)
  }

  for (const createdId of createdPageIds) {
    if (!inserted.has(createdId) && !nextPageIds.includes(createdId)) {
      nextPageIds.push(createdId)
    }
  }

  state.pageIds = nextPageIds
}

function applyReorderPages(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  const payload = toRecord(serialized.payload)
  const newOrder = Array.isArray(payload.newOrder) ? payload.newOrder : []
  const pageIds: string[] = []

  for (const entry of newOrder) {
    if (!entry || typeof entry !== 'object') continue
    const id = (entry as { id?: unknown }).id
    const isDivider = (entry as { isDivider?: unknown }).isDivider
    if (typeof id !== 'string' || id.length === 0) continue
    if (isDivider === true) continue
    pageIds.push(id)
  }

  if (pageIds.length > 0) {
    state.pageIds = pageIds
  }
}

function applyRemoveSource(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  const payload = toRecord(serialized.payload)
  const snapshots = Array.isArray(payload.pageSnapshots) ? payload.pageSnapshots : []
  const pageIds: string[] = []

  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== 'object') continue
    const page = (snapshot as { page?: unknown }).page
    if (!page || typeof page !== 'object') continue
    const id = (page as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) {
      pageIds.push(id)
    }
  }

  removePageIds(state, pageIds)
}

function applyCommandToTracker(serialized: SerializedCommand, state: WorkflowPageTrackerState): void {
  if (serialized.type === CommandType.BATCH) {
    const payload = toRecord(serialized.payload)
    const children = Array.isArray(payload.commands) ? payload.commands : []
    for (const child of children) {
      if (!child || typeof child !== 'object') continue
      const childSerialized = child as SerializedCommand
      applyCommandToTracker(childSerialized, state)
    }
    return
  }

  if (serialized.type === CommandType.ADD) {
    applyAddPages(serialized, state)
    return
  }

  if (serialized.type === CommandType.DELETE) {
    applyDeletePages(serialized, state)
    return
  }

  if (serialized.type === CommandType.DUPLICATE) {
    applyDuplicatePages(serialized, state)
    return
  }

  if (serialized.type === CommandType.REORDER) {
    applyReorderPages(serialized, state)
    return
  }

  if (serialized.type === CommandType.REMOVE_SOURCE) {
    applyRemoveSource(serialized, state)
  }
}

function mapRotateCommandToCandidate(
  serialized: SerializedCommand,
  state: WorkflowPageTrackerState,
  fallbackLabel: string,
): WorkflowCandidateStep | null {
  const payload = toRecord(serialized.payload)
  const pageIds = toStringArray(payload.pageIds)
  const degrees = Number(payload.degrees)
  if (!Number.isFinite(degrees) || degrees === 0) return null
  if (state.pageIds.length === 0 || pageIds.length === 0) return null

  const pageIdSet = new Set(state.pageIds)
  const selectedSet = new Set(pageIds.filter((id) => pageIdSet.has(id)))
  if (selectedSet.size === 0) return null

  const allSet = new Set(state.pageIds)
  const evenSet = new Set(
    state.pageIds.filter((_, index) => (index + 1) % 2 === 0),
  )
  const oddSet = new Set(
    state.pageIds.filter((_, index) => (index + 1) % 2 === 1),
  )

  let commandType: string | null = null
  let label = fallbackLabel

  if (setEquals(selectedSet, allSet)) {
    commandType = WorkflowActionType.ROTATE_ALL
    label = degrees > 0 ? 'Rotate all pages right' : 'Rotate all pages left'
  } else if (evenSet.size > 0 && setEquals(selectedSet, evenSet)) {
    commandType = WorkflowActionType.ROTATE_EVEN
    label = degrees > 0 ? 'Rotate even pages right' : 'Rotate even pages left'
  } else if (oddSet.size > 0 && setEquals(selectedSet, oddSet)) {
    commandType = WorkflowActionType.ROTATE_ODD
    label = degrees > 0 ? 'Rotate odd pages right' : 'Rotate odd pages left'
  }

  if (!commandType) return null

  return {
    commandId: toCommandId(serialized),
    label,
    commandType,
    params: { degrees },
    includeByDefault: true,
    sourceCommandType: serialized.type,
  }
}

function mapDeleteCommandToCandidate(
  serialized: SerializedCommand,
  state: WorkflowPageTrackerState,
): WorkflowCandidateStep | null {
  const payload = toRecord(serialized.payload)
  const snapshots = Array.isArray(payload.backupSnapshots) ? payload.backupSnapshots : []
  if (snapshots.length !== 1 || state.pageIds.length === 0) return null

  const snapshot = snapshots[0]
  if (!snapshot || typeof snapshot !== 'object') return null
  const page = (snapshot as { page?: unknown }).page
  const snapshotPageId =
    page && typeof page === 'object' && typeof (page as { id?: unknown }).id === 'string'
      ? ((page as { id: string }).id as string)
      : null
  const index = (snapshot as { index?: unknown }).index

  const firstPageId = state.pageIds[0]
  const lastPageId = state.pageIds[state.pageIds.length - 1]

  if ((snapshotPageId && snapshotPageId === firstPageId) || index === 0) {
    return {
      commandId: toCommandId(serialized),
      label: 'Delete first page',
      commandType: WorkflowActionType.DELETE_FIRST_PAGE,
      params: {},
      includeByDefault: true,
      sourceCommandType: serialized.type,
    }
  }

  if (
    (snapshotPageId && snapshotPageId === lastPageId) ||
    (typeof index === 'number' && Number.isInteger(index) && index === state.pageIds.length - 1)
  ) {
    return {
      commandId: toCommandId(serialized),
      label: 'Delete last page',
      commandType: WorkflowActionType.DELETE_LAST_PAGE,
      params: {},
      includeByDefault: true,
      sourceCommandType: serialized.type,
    }
  }

  return null
}

function mapCommandToCandidate(
  serialized: SerializedCommand,
  state: WorkflowPageTrackerState,
  fallbackLabel: string,
): WorkflowCandidateStep | null {
  if (serialized.type === CommandType.ROTATE) {
    return mapRotateCommandToCandidate(serialized, state, fallbackLabel)
  }
  if (serialized.type === CommandType.DELETE) {
    return mapDeleteCommandToCandidate(serialized, state)
  }
  return null
}

function collectCandidatesFromSerialized(
  serialized: SerializedCommand,
  state: WorkflowPageTrackerState,
  fallbackLabel: string,
  result: WorkflowCandidateBuildResult,
): void {
  if (serialized.type === CommandType.BATCH) {
    const payload = toRecord(serialized.payload)
    const children = Array.isArray(payload.commands) ? payload.commands : []
    for (const child of children) {
      if (!child || typeof child !== 'object') continue
      collectCandidatesFromSerialized(child as SerializedCommand, state, fallbackLabel, result)
    }
    return
  }

  const candidate = mapCommandToCandidate(serialized, state, fallbackLabel)
  if (candidate) {
    result.candidates.push(candidate)
  } else if (serialized.type === CommandType.ROTATE || serialized.type === CommandType.DELETE) {
    result.unsupportedCount += 1
  }

  applyCommandToTracker(serialized, state)
}

export function buildWorkflowCandidateSteps(
  commands: ReadonlyArray<Command>,
): WorkflowCandidateBuildResult {
  const trackerState: WorkflowPageTrackerState = { pageIds: [] }
  const result: WorkflowCandidateBuildResult = {
    candidates: [],
    unsupportedCount: 0,
  }

  for (const command of commands) {
    const serialized = command.serialize()
    collectCandidatesFromSerialized(serialized, trackerState, command.name, result)
  }

  return result
}

export function materializeWorkflowSteps(
  candidates: ReadonlyArray<WorkflowCandidateStep>,
): WorkflowStep[] {
  return candidates.map((candidate) => ({
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `workflow-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: candidate.label,
    commandType: candidate.commandType,
    params: toPlain(candidate.params),
  }))
}


