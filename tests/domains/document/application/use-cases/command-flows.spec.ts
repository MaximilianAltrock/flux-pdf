import { describe, expect, it, vi } from 'vitest'
import { ROTATION_DELTA_DEGREES } from '@/shared/constants'
import {
  addPages,
  addPagesBatch,
  addSource,
  addSources,
  deletePages,
  duplicatePages,
  removeSource,
  resizePages,
  rotatePages,
  splitGroup,
} from '@/domains/document/application/use-cases'
import {
  AddPagesCommand,
  AddSourceCommand,
  DeletePagesCommand,
  DuplicatePagesCommand,
  RemoveSourceCommand,
  ResizePagesCommand,
  RotatePagesCommand,
  SplitGroupCommand,
} from '@/domains/history/domain/commands'
import type { PageEntry, PageReference, SourceFile } from '@/shared/types'

function createSource(id: string, pageCount = 1): SourceFile {
  return {
    id,
    filename: `${id}.pdf`,
    pageCount,
    fileSize: 128,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: Array.from({ length: pageCount }, () => ({ width: 612, height: 792 })),
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
    groupId: 'group-1',
  }
}

describe('document command-flow use-cases', () => {
  it('delegates add pages to history execution', () => {
    const history = { execute: vi.fn() }
    const source = createSource('source-1', 2)
    const page = createPage('page-1', source.id)

    const command = addPages(history, source, [page], false)

    expect(command).toBeInstanceOf(AddPagesCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates add source to history execution', () => {
    const history = { execute: vi.fn() }
    const source = createSource('source-1')

    const command = addSource(history, source)

    expect(command).toBeInstanceOf(AddSourceCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates add pages batch to executeBatch when available', () => {
    const source = createSource('source-1')
    const pageOne = createPage('page-1', source.id, 0)
    const pageTwo = createPage('page-2', source.id, 1)
    const batchProxy = new AddSourceCommand(source)
    const history = {
      execute: vi.fn(),
      executeBatch: vi.fn().mockReturnValue(batchProxy),
    }

    const command = addPagesBatch(
      history,
      [
        { sourceFile: source, pages: [pageOne], shouldAddSource: false },
        { sourceFile: source, pages: [pageTwo], shouldAddSource: false },
      ],
      'Add pages from source',
    )

    expect(command).toBe(batchProxy)
    expect(history.executeBatch).toHaveBeenCalledOnce()
    const [commands, label] = history.executeBatch.mock.calls[0] ?? []
    expect(Array.isArray(commands)).toBe(true)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toBeInstanceOf(AddPagesCommand)
    expect(commands[1]).toBeInstanceOf(AddPagesCommand)
    expect(label).toBe('Add pages from source')
    expect(history.execute).not.toHaveBeenCalled()
  })

  it('delegates add source batch to executeBatch when available', () => {
    const first = createSource('source-1')
    const second = createSource('source-2')
    const batchProxy = new AddSourceCommand(first)
    const history = {
      execute: vi.fn(),
      executeBatch: vi.fn().mockReturnValue(batchProxy),
    }

    const command = addSources(history, [first, second], 'Register sources')

    expect(command).toBe(batchProxy)
    expect(history.executeBatch).toHaveBeenCalledOnce()
    const [commands, label] = history.executeBatch.mock.calls[0] ?? []
    expect(Array.isArray(commands)).toBe(true)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toBeInstanceOf(AddSourceCommand)
    expect(commands[1]).toBeInstanceOf(AddSourceCommand)
    expect(label).toBe('Register sources')
    expect(history.execute).not.toHaveBeenCalled()
  })

  it('delegates delete pages to history execution', () => {
    const history = { execute: vi.fn() }

    const command = deletePages(history, ['page-1', 'page-2'])

    expect(command).toBeInstanceOf(DeletePagesCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates duplicate pages to history execution', () => {
    const history = { execute: vi.fn() }

    const command = duplicatePages(history, ['page-1'])

    expect(command).toBeInstanceOf(DuplicatePagesCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates rotate pages to history execution', () => {
    const history = { execute: vi.fn() }

    const command = rotatePages(history, ['page-1'], ROTATION_DELTA_DEGREES.RIGHT)

    expect(command).toBeInstanceOf(RotatePagesCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates resize pages to history execution', () => {
    const history = { execute: vi.fn() }

    const command = resizePages(history, [
      {
        pageId: 'page-1',
        targetDimensions: { width: 612, height: 792 },
      },
    ])

    expect(command).toBeInstanceOf(ResizePagesCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates split group to history execution', () => {
    const history = { execute: vi.fn() }

    const command = splitGroup(history, 3)

    expect(command).toBeInstanceOf(SplitGroupCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates remove source to history execution', () => {
    const history = { execute: vi.fn() }
    const source = createSource('source-1')
    const pages: PageEntry[] = [
      {
        id: 'page-1',
        sourceFileId: source.id,
        sourcePageIndex: 0,
        rotation: 0,
      },
    ]

    const command = removeSource(history, source, pages)

    expect(command).toBeInstanceOf(RemoveSourceCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })
})
