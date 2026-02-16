import { describe, expect, it, vi } from 'vitest'
import { reorderPages } from '@/domains/document/application/use-cases/reorder-pages'
import { ReorderPagesCommand } from '@/domains/history/domain/commands'
import type { PageEntry } from '@/shared/types'

describe('reorderPages use-case', () => {
  it('creates a reorder command and delegates execution to history', () => {
    const history = {
      execute: vi.fn(),
    }
    const previousOrder: PageEntry[] = [
      {
        id: 'page-a',
        sourceFileId: 'source-1',
        sourcePageIndex: 0,
        rotation: 0,
      },
      {
        id: 'page-b',
        sourceFileId: 'source-1',
        sourcePageIndex: 1,
        rotation: 0,
      },
    ]
    const nextOrder: PageEntry[] = [previousOrder[1]!, previousOrder[0]!]

    const command = reorderPages(history, previousOrder, nextOrder)

    expect(command).toBeInstanceOf(ReorderPagesCommand)
    expect(command.label).toBe('Reorder pages')
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })
})
