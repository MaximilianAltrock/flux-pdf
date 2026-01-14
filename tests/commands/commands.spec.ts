import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  AddPagesCommand,
  BatchCommand,
  DeletePagesCommand,
  DuplicatePagesCommand,
  ReorderPagesCommand,
  RemoveSourceCommand,
  RotatePagesCommand,
  SplitGroupCommand,
  type Command,
  COMMAND_SCHEMA_VERSION,
} from '@/commands'
import { useDocumentStore } from '@/stores/document'
import type { PageEntry, PageReference, SourceFile } from '@/types'

const makeSource = (id: string, pageCount = 1): SourceFile => ({
  id,
  filename: `${id}.pdf`,
  pageCount,
  fileSize: pageCount * 1000,
  addedAt: Date.now(),
  color: '#111111',
})

const makePages = (sourceId: string, count: number): PageReference[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${sourceId}-p${index + 1}`,
    sourceFileId: sourceId,
    sourcePageIndex: index,
    rotation: 0,
    groupId: sourceId,
  }))

const makeDivider = (id: string): PageEntry => ({ id, isDivider: true })

const ids = (pages: PageEntry[]) => pages.map((page) => page.id)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('AddPagesCommand', () => {
  it('adds pages and source metadata and can undo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 2)
    const pages = makePages(source.id, 2)

    const cmd = new AddPagesCommand(source, pages, true, 'cmd-add', 123)
    cmd.execute()

    expect(store.sources.has(source.id)).toBe(true)
    expect(store.pages).toHaveLength(2)
    expect(ids(store.pages)).toEqual(ids(pages))
    expect(store.pages[0]).not.toBe(pages[0])

    cmd.undo()

    expect(store.pages).toHaveLength(0)
    expect(store.sources.has(source.id)).toBe(false)
  })

  it('keeps existing sources when shouldAddSource is false', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 1)
    const pages = makePages(source.id, 1)

    store.addSourceFile(source)

    const cmd = new AddPagesCommand(source, pages, false)
    cmd.execute()

    expect(store.sources.size).toBe(1)
    expect(store.pages).toHaveLength(1)

    cmd.undo()

    expect(store.pages).toHaveLength(0)
    expect(store.sources.size).toBe(1)
  })

  it('serializes and deserializes payload data', () => {
    const source = makeSource('source-1', 1)
    const pages = makePages(source.id, 1)

    const cmd = new AddPagesCommand(source, pages, false, 'cmd-add', 456)
    const serialized = cmd.serialize()
    const restored = AddPagesCommand.deserialize(serialized)

    expect(restored.id).toBe('cmd-add')
    expect(restored.createdAt).toBe(456)
    expect(restored.sourceFile).toEqual(source)
    expect(restored.pages).toEqual(pages)
    expect(restored.shouldAddSource).toBe(false)
  })
})

describe('DeletePagesCommand', () => {
  it('deletes pages and restores them in place on undo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 3)
    store.addSourceFile(source)

    const pages = makePages(source.id, 3)
    const divider = makeDivider('divider-1')
    const initialOrder: PageEntry[] = [pages[0], divider, pages[1], pages[2]]
    store.setPages(initialOrder)

    const cmd = new DeletePagesCommand([pages[1].id, pages[2].id])
    cmd.execute()

    expect(ids(store.pages)).toEqual([pages[0].id, divider.id])

    cmd.undo()

    expect(ids(store.pages)).toEqual(ids(initialOrder))
  })

  it('rehydrates snapshots for undo after deserialization', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 2)
    store.addSourceFile(source)

    const pages = makePages(source.id, 2)
    store.setPages([...pages])

    const cmd = new DeletePagesCommand([pages[0].id, pages[1].id], 'cmd-del', undefined, 789)
    cmd.execute()

    const serialized = cmd.serialize()
    const payload = serialized.payload as { backupSnapshots: unknown[] }
    expect(payload.backupSnapshots).toHaveLength(2)

    const restored = DeletePagesCommand.deserialize(serialized)
    restored.undo()

    expect(ids(store.pages)).toEqual(ids(pages))
  })
})

describe('DuplicatePagesCommand', () => {
  it('duplicates pages after their sources and can undo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 3)
    store.addSourceFile(source)

    const pages = makePages(source.id, 3)
    store.addPages(pages)

    const cmd = new DuplicatePagesCommand([pages[0].id, pages[2].id])
    cmd.execute()

    expect(store.pages).toHaveLength(5)

    const currentIds = ids(store.pages)
    expect(currentIds[0]).toBe(pages[0].id)
    expect(currentIds[2]).toBe(pages[1].id)
    expect(currentIds[3]).toBe(pages[2].id)
    expect(currentIds[1]).not.toBe(pages[0].id)
    expect(currentIds[4]).not.toBe(pages[2].id)
    expect(currentIds[1]).not.toBe(currentIds[4])

    const duplicateAfterFirst = store.pages[1] as PageReference
    const duplicateAfterThird = store.pages[4] as PageReference

    expect(duplicateAfterFirst.sourcePageIndex).toBe(pages[0].sourcePageIndex)
    expect(duplicateAfterThird.sourcePageIndex).toBe(pages[2].sourcePageIndex)

    cmd.undo()

    expect(ids(store.pages)).toEqual(ids(pages))
  })

  it('reuses created IDs on redo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 2)
    store.addSourceFile(source)

    const pages = makePages(source.id, 2)
    store.addPages(pages)

    const cmd = new DuplicatePagesCommand([pages[0].id, pages[1].id])
    cmd.execute()

    const firstPayload = cmd.serialize().payload as { createdPageIds: string[] }
    const firstIds = [...firstPayload.createdPageIds]

    cmd.undo()
    cmd.execute()

    const secondPayload = cmd.serialize().payload as { createdPageIds: string[] }
    expect(secondPayload.createdPageIds).toEqual(firstIds)

    const currentIds = ids(store.pages)
    expect(currentIds).toContain(firstIds[0])
    expect(currentIds).toContain(firstIds[1])
  })
})

describe('ReorderPagesCommand', () => {
  it('reorders pages and can undo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 3)
    store.addSourceFile(source)

    const pages = makePages(source.id, 3)
    store.setPages([...pages])

    const previousOrder = [...store.pages]
    const newOrder = [...store.pages].reverse()
    const cmd = new ReorderPagesCommand(previousOrder, newOrder)

    cmd.execute()
    expect(ids(store.pages)).toEqual(ids(newOrder))

    cmd.undo()
    expect(ids(store.pages)).toEqual(ids(previousOrder))

    const restored = ReorderPagesCommand.deserialize(cmd.serialize())
    restored.execute()
    expect(ids(store.pages)).toEqual(ids(newOrder))
  })
})

describe('RotatePagesCommand', () => {
  it('rotates pages and can undo with the inverse rotation', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 2)
    store.addSourceFile(source)

    const pages = makePages(source.id, 2)
    store.addPages(pages)

    const cmd = new RotatePagesCommand([pages[0].id, pages[1].id], 90)
    cmd.execute()

    expect(store.contentPages[0]?.rotation).toBe(90)
    expect(store.contentPages[1]?.rotation).toBe(90)

    cmd.undo()

    expect(store.contentPages[0]?.rotation).toBe(0)
    expect(store.contentPages[1]?.rotation).toBe(0)
  })
})

describe('SplitGroupCommand', () => {
  it('inserts a divider and removes it on undo', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 2)
    store.addSourceFile(source)

    const pages = makePages(source.id, 2)
    store.addPages(pages)

    const cmd = new SplitGroupCommand(1)
    cmd.execute()

    expect(store.pages).toHaveLength(3)
    expect(store.pages[1]?.isDivider).toBe(true)

    const serialized = cmd.serialize()
    const restored = SplitGroupCommand.deserialize(serialized)

    expect(restored.index).toBe(1)
    expect(restored.divider.id).toBe(cmd.divider.id)

    cmd.undo()

    expect(ids(store.pages)).toEqual(ids(pages))
  })
})

describe('RemoveSourceCommand', () => {
  it('removes source pages and restores them on undo', () => {
    const store = useDocumentStore()
    const sourceA = makeSource('source-a', 2)
    const sourceB = makeSource('source-b', 1)
    store.addSourceFile(sourceA)
    store.addSourceFile(sourceB)

    const pagesA = makePages(sourceA.id, 2)
    const pagesB = makePages(sourceB.id, 1)
    const divider = makeDivider('divider-1')
    const initialOrder: PageEntry[] = [pagesA[0], pagesB[0], divider, pagesA[1]]
    store.setPages(initialOrder)

    const cmd = new RemoveSourceCommand(sourceA, store.pages)
    cmd.execute()

    expect(store.sources.has(sourceA.id)).toBe(false)
    expect(ids(store.pages)).toEqual([pagesB[0].id, divider.id])

    const restored = RemoveSourceCommand.deserialize(cmd.serialize())
    restored.undo()

    expect(store.sources.has(sourceA.id)).toBe(true)
    expect(ids(store.pages)).toEqual(ids(initialOrder))
  })
})

describe('BatchCommand', () => {
  it('executes commands in order and undoes them in reverse', () => {
    const events: string[] = []

    const makeTestCommand = (label: string): Command => ({
      id: label,
      type: `Test-${label}`,
      name: label,
      createdAt: 0,
      execute: () => events.push(`do-${label}`),
      undo: () => events.push(`undo-${label}`),
      serialize: () => ({
        version: COMMAND_SCHEMA_VERSION,
        type: `Test-${label}`,
        payload: { id: label },
        timestamp: 0,
      }),
    })

    const batch = new BatchCommand([makeTestCommand('A'), makeTestCommand('B')], 'Batch')
    batch.execute()
    batch.undo()

    expect(events).toEqual(['do-A', 'do-B', 'undo-B', 'undo-A'])
  })

  it('rehydrates child commands from serialized payloads', () => {
    const store = useDocumentStore()
    const source = makeSource('source-1', 1)
    const pages = makePages(source.id, 1)

    const batch = new BatchCommand(
      [
        new AddPagesCommand(source, pages, true, 'cmd-add', 100),
        new RotatePagesCommand([pages[0].id], 90, 'cmd-rotate', 101),
      ],
      'Add and rotate',
      'cmd-batch',
      99,
    )

    const serialized = batch.serialize()
    const restored = BatchCommand.deserialize(serialized)

    restored.execute()

    expect(store.sources.has(source.id)).toBe(true)
    expect(store.contentPages[0]?.rotation).toBe(90)

    restored.undo()

    expect(store.pages).toHaveLength(0)
  })
})
