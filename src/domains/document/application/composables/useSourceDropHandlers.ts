import { ROTATION_DEFAULT_DEGREES } from '@/shared/constants'
import { executeCommandBatch, type HistoryBatchCommandExecutor } from '@/domains/history/application'
import { AddPagesCommand } from '@/domains/history/domain/commands'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { PageReference } from '@/shared/types'

export interface SourceDropHandlersDeps {
  store: ReturnType<typeof useDocumentStore>
  history: HistoryBatchCommandExecutor
}

export function useSourceDropHandlers({ store, history }: SourceDropHandlersDeps) {
  function handleSourceDropped(sourceId: string) {
    const sourceFile = store.sources.get(sourceId)
    if (!sourceFile) return

    const groupId = crypto.randomUUID()
    const newPages: PageReference[] = []

    for (let i = 0; i < sourceFile.pageCount; i++) {
      const metrics = sourceFile.pageMetaData?.[i]
      newPages.push({
        id: crypto.randomUUID(),
        sourceFileId: sourceFile.id,
        sourcePageIndex: i,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: metrics?.width,
        height: metrics?.height,
        groupId,
      })
    }

    history.execute(new AddPagesCommand(sourceFile, newPages, false))
  }

  function handleSourcePageDropped(sourceId: string, pageIndex: number) {
    const sourceFile = store.sources.get(sourceId)
    if (!sourceFile) return
    if (pageIndex < 0 || pageIndex >= sourceFile.pageCount) return

    const pageRef: PageReference = {
      id: crypto.randomUUID(),
      sourceFileId: sourceFile.id,
      sourcePageIndex: pageIndex,
      rotation: ROTATION_DEFAULT_DEGREES,
      width: sourceFile.pageMetaData?.[pageIndex]?.width,
      height: sourceFile.pageMetaData?.[pageIndex]?.height,
      groupId: crypto.randomUUID(),
    }

    history.execute(new AddPagesCommand(sourceFile, [pageRef], false))
  }

  function handleSourcePagesDropped(pages: { sourceId: string; pageIndex: number }[]) {
    if (!pages || pages.length === 0) return

    const grouped = new Map<string, Set<number>>()
    for (const page of pages) {
      if (!page || !page.sourceId || !Number.isInteger(page.pageIndex)) continue
      const sourceFile = store.sources.get(page.sourceId)
      if (!sourceFile) continue
      if (page.pageIndex < 0 || page.pageIndex >= sourceFile.pageCount) continue

      if (!grouped.has(page.sourceId)) grouped.set(page.sourceId, new Set())
      grouped.get(page.sourceId)?.add(page.pageIndex)
    }

    const commands: AddPagesCommand[] = []

    for (const [sourceId, pageSet] of grouped) {
      const sourceFile = store.sources.get(sourceId)
      if (!sourceFile) continue

      const sorted = Array.from(pageSet).sort((a, b) => a - b)
      if (sorted.length === 0) continue

      const groupId = crypto.randomUUID()
      const newPages: PageReference[] = sorted.map((pageIndex) => ({
        id: crypto.randomUUID(),
        sourceFileId: sourceFile.id,
        sourcePageIndex: pageIndex,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: sourceFile.pageMetaData?.[pageIndex]?.width,
        height: sourceFile.pageMetaData?.[pageIndex]?.height,
        groupId,
      }))

      commands.push(new AddPagesCommand(sourceFile, newPages, false))
    }

    if (commands.length === 0) return

    executeCommandBatch(
      history,
      commands,
      commands.length > 1 ? `Add pages from ${commands.length} sources` : undefined,
    )
  }

  return {
    handleSourceDropped,
    handleSourcePageDropped,
    handleSourcePagesDropped,
  }
}
