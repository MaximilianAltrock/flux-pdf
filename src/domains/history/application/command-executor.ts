import { ROTATION_DELTA_DEGREES, type RotationDelta } from '@/shared/constants'
import {
  isPageEntry,
  type OutlineNode,
  type PageEntry,
  type PageReference,
  type RedactionMark,
  type SourceFile,
} from '@/shared/types'
import {
  AddPagesCommand,
  AddRedactionCommand,
  AddSourceCommand,
  BatchCommand,
  CommandType,
  DeletePagesCommand,
  DeleteRedactionCommand,
  DuplicatePagesCommand,
  RemoveSourceCommand,
  ReorderPagesCommand,
  ResizePagesCommand,
  RotatePagesCommand,
  SplitGroupCommand,
  UpdateOutlineCommand,
  UpdateRedactionCommand,
} from '@/domains/history/domain/commands'
import type { Command, PageSnapshot } from '@/domains/history/domain/commands/types'
import { createLogger, type Logger } from '@/shared/infrastructure/logger'
import {
  cloneDividerReference,
  cloneOutlineTree,
  clonePageEntries,
  clonePageReference,
  clonePageReferences,
  cloneRedactionMark,
  cloneSourceFile,
} from '@/shared/utils/document-clone'

export interface HistoryDocumentStoreAdapter {
  sources: Map<string, SourceFile>
  pages: PageEntry[]
  addSourceFile(sourceFile: SourceFile): void
  removeSourceOnly(sourceFileId: string): void
  addPages(newPages: PageReference[]): void
  insertPages(index: number, newPages: PageEntry[]): void
  deletePages(ids: string[]): void
  reorderPages(newOrder: PageEntry[]): void
  rotatePage(pageId: string, degrees: RotationDelta): void
  setPageTargetDimensions(
    pageId: string,
    targetDimensions?: { width: number; height: number } | null,
  ): void
  addRedaction(pageId: string, redaction: RedactionMark): void
  addRedactions(pageId: string, redactions: RedactionMark[]): void
  updateRedaction(pageId: string, redaction: RedactionMark): void
  removeRedaction(pageId: string, redactionId: string): void
  removeRedactions(pageId: string, redactionIds: string[]): void
  setOutlineTree(tree: OutlineNode[], markDirty?: boolean): void
  setOutlineDirty(value: boolean): void
}

export interface HistoryCommandExecutorDeps {
  documentStore: HistoryDocumentStoreAdapter
  logger?: Logger
}

export interface HistoryCommandRunner {
  execute(command: Command): void
  undo(command: Command): void
}

type ExecutionDirection = 'execute' | 'undo'

export function createHistoryCommandExecutor(deps: HistoryCommandExecutorDeps): HistoryCommandRunner {
  const log = deps.logger ?? createLogger('history-executor')

  return {
    execute(command) {
      applyCommand(command, 'execute', deps.documentStore, log)
    },
    undo(command) {
      applyCommand(command, 'undo', deps.documentStore, log)
    },
  }
}

function applyCommand(
  command: Command,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
  log: Logger,
): void {
  if (command.type === CommandType.BATCH && command instanceof BatchCommand) {
    const children = [...command.getCommands()]
    const orderedChildren = direction === 'execute' ? children : children.reverse()
    for (const child of orderedChildren) {
      applyCommand(child, direction, store, log)
    }
    return
  }

  if (command.type === CommandType.ADD && command instanceof AddPagesCommand) {
    applyAddPages(command, direction, store)
    return
  }

  if (command.type === CommandType.ADD_SOURCE && command instanceof AddSourceCommand) {
    applyAddSource(command, direction, store)
    return
  }

  if (command.type === CommandType.DELETE && command instanceof DeletePagesCommand) {
    applyDeletePages(command, direction, store)
    return
  }

  if (command.type === CommandType.DUPLICATE && command instanceof DuplicatePagesCommand) {
    applyDuplicatePages(command, direction, store)
    return
  }

  if (command.type === CommandType.REORDER && command instanceof ReorderPagesCommand) {
    applyReorderPages(command, direction, store)
    return
  }

  if (command.type === CommandType.ROTATE && command instanceof RotatePagesCommand) {
    applyRotatePages(command, direction, store)
    return
  }

  if (command.type === CommandType.RESIZE && command instanceof ResizePagesCommand) {
    applyResizePages(command, direction, store)
    return
  }

  if (command.type === CommandType.SPLIT && command instanceof SplitGroupCommand) {
    applySplitGroup(command, direction, store)
    return
  }

  if (command.type === CommandType.REMOVE_SOURCE && command instanceof RemoveSourceCommand) {
    applyRemoveSource(command, direction, store)
    return
  }

  if (command.type === CommandType.REDACT && command instanceof AddRedactionCommand) {
    applyAddRedaction(command, direction, store)
    return
  }

  if (command.type === CommandType.UPDATE_REDACTION && command instanceof UpdateRedactionCommand) {
    applyUpdateRedaction(command, direction, store)
    return
  }

  if (command.type === CommandType.DELETE_REDACTION && command instanceof DeleteRedactionCommand) {
    applyDeleteRedaction(command, direction, store)
    return
  }

  if (command.type === CommandType.UPDATE_OUTLINE && command instanceof UpdateOutlineCommand) {
    applyUpdateOutline(command, direction, store)
    return
  }

  log.warn(`No command handler registered for "${command.type}".`)
}

function applyAddPages(
  command: AddPagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    if (command.shouldAddSource && !store.sources.has(command.sourceFile.id)) {
      store.addSourceFile(cloneSourceFile(command.sourceFile))
    }
    store.addPages(clonePageReferences(command.pages))
    return
  }

  store.deletePages(command.pages.map((page) => page.id))
  if (command.shouldAddSource) {
    store.removeSourceOnly(command.sourceFile.id)
  }
}

function applyAddSource(
  command: AddSourceCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    if (!store.sources.has(command.sourceFile.id)) {
      store.addSourceFile(cloneSourceFile(command.sourceFile))
    }
    return
  }

  store.removeSourceOnly(command.sourceFile.id)
}

function applyDeletePages(
  command: DeletePagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    if (command.backupSnapshots.length === 0) {
      command.backupSnapshots = captureSnapshots(store.pages, command.pageIds)
    }
    store.deletePages(command.pageIds)
    return
  }

  const snapshots = [...command.backupSnapshots].sort((a, b) => a.index - b.index)
  for (const snapshot of snapshots) {
    store.insertPages(snapshot.index, [clonePageReference(snapshot.page)])
  }
}

function captureSnapshots(pages: ReadonlyArray<PageEntry>, pageIds: ReadonlyArray<string>): PageSnapshot[] {
  const pageIdSet = new Set(pageIds)
  const snapshots: PageSnapshot[] = []

  pages.forEach((page, index) => {
    if (!isPageEntry(page)) return
    if (!pageIdSet.has(page.id)) return
    snapshots.push({
      page: clonePageReference(page),
      index,
    })
  })

  return snapshots
}

function applyDuplicatePages(
  command: DuplicatePagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'undo') {
    store.deletePages(command.createdPageIds)
    return
  }

  const pagesToDuplicate: { page: PageReference; index: number }[] = []

  for (const sourceId of command.sourcePageIds) {
    const index = store.pages.findIndex((page) => page.id === sourceId)
    if (index < 0) continue

    const page = store.pages[index]
    if (!page || !isPageEntry(page)) continue

    pagesToDuplicate.push({
      page,
      index,
    })
  }

  pagesToDuplicate.sort((a, b) => b.index - a.index)

  const isRedo = command.createdPageIds.length > 0
  const createdIds: string[] = []
  let reuseIndex = 0

  for (const { page, index } of pagesToDuplicate) {
    const reuseId = command.createdPageIds[command.createdPageIds.length - 1 - reuseIndex]
    const newId = isRedo && reuseId ? reuseId : crypto.randomUUID()

    const duplicate = clonePageReference(page)
    duplicate.id = newId
    store.insertPages(index + 1, [duplicate])

    if (!isRedo) {
      createdIds.push(newId)
    }
    reuseIndex += 1
  }

  if (!isRedo) {
    command.createdPageIds = createdIds.reverse()
  }
}

function applyReorderPages(
  command: ReorderPagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  const nextOrder = direction === 'execute' ? command.newOrder : command.previousOrder
  store.reorderPages(clonePageEntries(nextOrder))
}

function applyRotatePages(
  command: RotatePagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  const degrees = direction === 'execute' ? command.degrees : reverseRotation(command.degrees)
  for (const pageId of command.pageIds) {
    store.rotatePage(pageId, degrees)
  }
}

function reverseRotation(value: RotationDelta): RotationDelta {
  return value === ROTATION_DELTA_DEGREES.RIGHT
    ? ROTATION_DELTA_DEGREES.LEFT
    : ROTATION_DELTA_DEGREES.RIGHT
}

function applyResizePages(
  command: ResizePagesCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    if (command.previousTargets.length === 0) {
      command.previousTargets = command.targets.map((target) => {
        const page = store.pages.find(
          (entry): entry is PageReference => isPageEntry(entry) && entry.id === target.pageId,
        )
        return {
          pageId: target.pageId,
          targetDimensions: page?.targetDimensions ? { ...page.targetDimensions } : null,
        }
      })
    }

    for (const target of command.targets) {
      store.setPageTargetDimensions(target.pageId, target.targetDimensions ?? null)
    }
    return
  }

  for (const target of command.previousTargets) {
    store.setPageTargetDimensions(target.pageId, target.targetDimensions ?? null)
  }
}

function applySplitGroup(
  command: SplitGroupCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    store.insertPages(command.index, [cloneDividerReference(command.divider)])
    return
  }

  store.deletePages([command.divider.id])
}

function applyRemoveSource(
  command: RemoveSourceCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    const pageIds = command.pageSnapshots.map((snapshot) => snapshot.page.id)
    store.deletePages(pageIds)
    store.removeSourceOnly(command.sourceFile.id)
    return
  }

  if (!store.sources.has(command.sourceFile.id)) {
    store.addSourceFile(cloneSourceFile(command.sourceFile))
  }

  const snapshots = [...command.pageSnapshots].sort((a, b) => a.index - b.index)
  for (const snapshot of snapshots) {
    store.insertPages(snapshot.index, [clonePageReference(snapshot.page)])
  }
}

function applyAddRedaction(
  command: AddRedactionCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    store.addRedactions(command.pageId, command.redactions.map(cloneRedactionMark))
    return
  }

  store.removeRedactions(
    command.pageId,
    command.redactions.map((redaction) => redaction.id),
  )
}

function applyUpdateRedaction(
  command: UpdateRedactionCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  const redaction = direction === 'execute' ? command.next : command.previous
  store.updateRedaction(command.pageId, cloneRedactionMark(redaction))
}

function applyDeleteRedaction(
  command: DeleteRedactionCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    store.removeRedaction(command.pageId, command.redaction.id)
    return
  }

  store.addRedaction(command.pageId, cloneRedactionMark(command.redaction))
}

function applyUpdateOutline(
  command: UpdateOutlineCommand,
  direction: ExecutionDirection,
  store: HistoryDocumentStoreAdapter,
): void {
  if (direction === 'execute') {
    store.setOutlineTree(cloneOutlineTree(command.nextTree), false)
    store.setOutlineDirty(command.nextDirty)
    return
  }

  store.setOutlineTree(cloneOutlineTree(command.previousTree), false)
  store.setOutlineDirty(command.previousDirty)
}
