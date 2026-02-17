import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { createHistoryCommandExecutor } from '@/domains/history/application'
import { AddPagesCommand, DeletePagesCommand, DuplicatePagesCommand } from '@/domains/history/domain/commands'
import type { PageReference, SourceFile } from '@/shared/types'

function createSource(id: string, pageCount = 1): SourceFile {
  return {
    id,
    filename: `${id}.pdf`,
    pageCount,
    fileSize: 1024,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: Array.from({ length: pageCount }, () => ({
      width: 612,
      height: 792,
      rotation: 0,
    })),
  }
}

function createPage(id: string, sourceFileId: string, sourcePageIndex = 0): PageReference {
  return {
    id,
    sourceFileId,
    sourcePageIndex,
    rotation: 0,
    width: 612,
    height: 792,
  }
}

describe('createHistoryCommandExecutor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('executes and undoes AddPagesCommand without domain store imports', () => {
    const store = useDocumentStore()
    const executor = createHistoryCommandExecutor({ documentStore: store })
    const source = createSource('source-1')
    const page = createPage('page-1', source.id)
    const command = new AddPagesCommand(source, [page], true)

    executor.execute(command)

    expect(store.sources.has(source.id)).toBe(true)
    expect(store.pages).toHaveLength(1)
    expect(store.pages[0]?.id).toBe(page.id)

    executor.undo(command)

    expect(store.sources.has(source.id)).toBe(false)
    expect(store.pages).toHaveLength(0)
  })

  it('captures delete snapshots on execute and restores exact page on undo', () => {
    const store = useDocumentStore()
    const executor = createHistoryCommandExecutor({ documentStore: store })
    const source = createSource('source-1')
    const page = createPage('page-1', source.id)

    store.addSourceFile(source)
    store.addPages([page])

    const command = new DeletePagesCommand([page.id])
    executor.execute(command)

    expect(command.backupSnapshots).toHaveLength(1)
    expect(store.pages).toHaveLength(0)

    executor.undo(command)

    expect(store.pages).toHaveLength(1)
    const restored = store.pages[0]
    expect(restored?.id).toBe(page.id)
    expect(restored && !restored.isDivider ? restored.sourceFileId : null).toBe(source.id)
  })

  it('reuses duplicated page IDs on redo', () => {
    const store = useDocumentStore()
    const executor = createHistoryCommandExecutor({ documentStore: store })
    const source = createSource('source-1')
    const page = createPage('page-1', source.id)

    store.addSourceFile(source)
    store.addPages([page])

    const command = new DuplicatePagesCommand([page.id])

    executor.execute(command)
    const firstIds = [...command.createdPageIds]
    expect(firstIds).toHaveLength(1)

    executor.undo(command)
    executor.execute(command)

    expect(command.createdPageIds).toEqual(firstIds)
    expect(store.pages.some((entry) => !entry.isDivider && entry.id === firstIds[0])).toBe(true)
  })
})
