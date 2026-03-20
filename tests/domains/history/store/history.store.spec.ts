import { describe, expect, it } from 'vitest'
import { createDocumentState } from '@/domains/project-session/session/document-state'
import { createHistorySession } from '@/domains/history/session/create-history-session'
import { AddSourceCommand, RemoveSourceCommand } from '@/domains/history/domain/commands'
import type { SourceFile } from '@/shared/types'

function createSource(id: string): SourceFile {
  return {
    id,
    filename: `${id}.pdf`,
    pageCount: 1,
    fileSize: 128,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: [{ width: 612, height: 792, rotation: 0 }],
  }
}

describe('createHistorySession', () => {
  it('uses command label for undo/redo names', () => {
    const document = createDocumentState()
    const history = createHistorySession(document)
    const source = createSource('source-1')
    const command = new AddSourceCommand(source)

    history.execute(command)

    expect(document.sources.has(source.id)).toBe(true)
    expect(history.undoName).toBe(command.label)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    history.undo()

    expect(document.sources.has(source.id)).toBe(false)
    expect(history.redoName).toBe(command.label)
    expect(history.canRedo).toBe(true)
  })

  it('executes grouped commands as a single history entry and undoes in reverse order', () => {
    const document = createDocumentState()
    const history = createHistorySession(document)
    const source = createSource('source-2')

    const first = new AddSourceCommand(source)
    const second = new RemoveSourceCommand(source, [])

    const result = history.executeBatch([first, second], 'Grouped edit')

    expect(result?.label).toBe('Grouped edit')
    expect(history.history).toHaveLength(1)
    expect(history.undoName).toBe('Grouped edit')
    expect(document.sources.has(source.id)).toBe(false)

    history.undo()

    // Reverse-order undo should end with source removed:
    // undo RemoveSource -> source added, then undo AddSource -> source removed
    expect(document.sources.has(source.id)).toBe(false)

    history.redo()

    expect(document.sources.has(source.id)).toBe(false)
  })

  it('rejects non-JSON payloads during history serialization', () => {
    const history = createHistorySession(createDocumentState())
    const source = createSource('source-unsafe')
    const unsafeCommand = new AddSourceCommand(source)
    unsafeCommand.serialize = () => ({
      type: unsafeCommand.type,
      payload: {
        id: unsafeCommand.id,
        map: new Map([['a', 1]]),
      },
      timestamp: unsafeCommand.createdAt,
    })

    history.execute(unsafeCommand)

    expect(() => history.serializeHistory()).toThrow('Map/Set')
  })
})
