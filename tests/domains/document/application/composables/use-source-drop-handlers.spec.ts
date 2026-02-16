import { describe, expect, it, vi } from 'vitest'
import { useSourceDropHandlers } from '@/domains/document/application/composables/useSourceDropHandlers'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import { AddPagesCommand } from '@/domains/history/domain/commands'
import type { Command } from '@/domains/history/domain/commands/types'
import type { SourceFile } from '@/shared/types'

function createSource(id: string, pageCount: number): SourceFile {
  return {
    id,
    filename: `${id}.pdf`,
    pageCount,
    fileSize: pageCount * 100,
    addedAt: Date.now(),
    color: 'blue',
    pageMetaData: Array.from({ length: pageCount }, () => ({
      width: 800,
      height: 1200,
      rotation: 0,
    })),
  }
}

function createHarness(sources: SourceFile[]) {
  const execute = vi.fn()
  const executeBatch = vi.fn<(
    commands: readonly Command[],
    label?: string,
  ) => Command | null>()
  const store = {
    sources: new Map(sources.map((source) => [source.id, source])),
  } as unknown as ReturnType<typeof useDocumentStore>

  const history = {
    execute,
    executeBatch,
  }

  return {
    history,
    ...useSourceDropHandlers({ store, history }),
  }
}

describe('useSourceDropHandlers', () => {
  it('adds all pages for a dropped source file', () => {
    const source = createSource('source-1', 3)
    const harness = createHarness([source])

    harness.handleSourceDropped(source.id)

    expect(harness.history.execute).toHaveBeenCalledOnce()
    const command = harness.history.execute.mock.calls[0]?.[0] as AddPagesCommand
    expect(command).toBeInstanceOf(AddPagesCommand)
    expect(command.sourceFile.id).toBe(source.id)
    expect(command.pages).toHaveLength(3)
    expect(command.pages.map((page) => page.sourcePageIndex)).toEqual([0, 1, 2])
    expect(command.shouldAddSource).toBe(false)
  })

  it('adds a single page for valid page drops and ignores invalid index', () => {
    const source = createSource('source-1', 2)
    const harness = createHarness([source])

    harness.handleSourcePageDropped(source.id, -1)
    harness.handleSourcePageDropped(source.id, 4)
    expect(harness.history.execute).not.toHaveBeenCalled()

    harness.handleSourcePageDropped(source.id, 1)
    expect(harness.history.execute).toHaveBeenCalledOnce()

    const command = harness.history.execute.mock.calls[0]?.[0] as AddPagesCommand
    expect(command.pages).toHaveLength(1)
    expect(command.pages[0]?.sourcePageIndex).toBe(1)
  })

  it('groups, deduplicates, and sorts source page drops by source', () => {
    const sourceA = createSource('source-a', 4)
    const sourceB = createSource('source-b', 3)
    const harness = createHarness([sourceA, sourceB])

    harness.handleSourcePagesDropped([
      { sourceId: sourceA.id, pageIndex: 2 },
      { sourceId: sourceA.id, pageIndex: 0 },
      { sourceId: sourceA.id, pageIndex: 2 },
      { sourceId: sourceB.id, pageIndex: 1 },
      { sourceId: 'missing', pageIndex: 0 },
      { sourceId: sourceB.id, pageIndex: 99 },
    ])

    expect(harness.history.execute).not.toHaveBeenCalled()
    expect(harness.history.executeBatch).toHaveBeenCalledOnce()

    const [commandsArg, label] = harness.history.executeBatch.mock.calls[0] ?? []
    const commands = (commandsArg ?? []) as AddPagesCommand[]
    const commandA = commands.find((command) => command.sourceFile.id === sourceA.id)
    const commandB = commands.find((command) => command.sourceFile.id === sourceB.id)

    expect(label).toBe('Add pages from 2 sources')
    expect(commands).toHaveLength(2)
    expect(commandA?.pages.map((page) => page.sourcePageIndex)).toEqual([0, 2])
    expect(commandB?.pages.map((page) => page.sourcePageIndex)).toEqual([1])
  })
})
