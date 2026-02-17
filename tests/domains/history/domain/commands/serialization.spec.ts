import { describe, expect, it } from 'vitest'
import {
  AddPagesCommand,
  AddSourceCommand,
  toJsonSafeSerializedCommand,
  type SerializedCommand,
} from '@/domains/history/domain/commands'
import { ROTATION_DEFAULT_DEGREES } from '@/shared/constants'
import type { PageReference, SourceFile } from '@/shared/types'

function createSerialized(payload?: Record<string, unknown>): SerializedCommand {
  return {
    type: 'Test',
    payload: {
      id: 'cmd-1',
      ...payload,
    },
    timestamp: Date.now(),
  }
}

describe('toJsonSafeSerializedCommand', () => {
  it('returns a deep plain clone when payload is JSON-safe', () => {
    const serialized = createSerialized({
      pageIds: ['a', 'b'],
      nested: {
        count: 2,
      },
    })

    const normalized = toJsonSafeSerializedCommand(serialized)

    expect(normalized).toEqual(serialized)
    expect(normalized).not.toBe(serialized)
    expect(normalized.payload).not.toBe(serialized.payload)
  })

  it('rejects payloads containing Date values', () => {
    const serialized = createSerialized({
      createdAt: new Date(),
    })

    expect(() => toJsonSafeSerializedCommand(serialized)).toThrow('Date')
  })

  it('rejects payloads containing binary data', () => {
    const serialized = createSerialized({
      bytes: new Uint8Array([1, 2, 3]),
    })

    expect(() => toJsonSafeSerializedCommand(serialized)).toThrow('binary data')
  })

  it('serializes source outlines that include optional undefined children', () => {
    const sourceFile: SourceFile = {
      id: 'source-1',
      filename: 'outline.pdf',
      pageCount: 1,
      fileSize: 1024,
      addedAt: 1,
      color: '#3b82f6',
      pageMetaData: [{ width: 612, height: 792, rotation: 0 }],
      outline: [{ title: 'Section', pageIndex: 0, children: undefined }],
    }

    const command = new AddSourceCommand(sourceFile, 'cmd-source', 1)
    const normalized = toJsonSafeSerializedCommand(command.serialize())
    const payload = normalized.payload as { sourceFile: SourceFile }

    expect(payload.sourceFile.outline).toEqual([{ title: 'Section', pageIndex: 0 }])
  })

  it('serializes page references without optional undefined keys', () => {
    const sourceFile: SourceFile = {
      id: 'source-2',
      filename: 'pages.pdf',
      pageCount: 1,
      fileSize: 512,
      addedAt: 2,
      color: '#22c55e',
      pageMetaData: [{ width: 612, height: 792, rotation: 0 }],
    }

    const pages: PageReference[] = [
      {
        id: 'page-1',
        sourceFileId: sourceFile.id,
        sourcePageIndex: 0,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: undefined,
        height: undefined,
        targetDimensions: undefined,
        redactions: undefined,
      },
    ]

    const command = new AddPagesCommand(sourceFile, pages, true, 'cmd-pages', 2)
    const normalized = toJsonSafeSerializedCommand(command.serialize())
    const payload = normalized.payload as { pages: PageReference[] }

    expect(payload.pages[0]).toEqual({
      id: 'page-1',
      sourceFileId: 'source-2',
      sourcePageIndex: 0,
      rotation: ROTATION_DEFAULT_DEGREES,
    })
  })
})
