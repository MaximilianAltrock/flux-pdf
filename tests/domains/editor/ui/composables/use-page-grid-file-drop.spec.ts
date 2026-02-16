import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePageGridFileDrop } from '@/domains/editor/ui/usePageGridFileDrop'

type TestDragEventInit = {
  types?: string[]
  jsonData?: string
  files?: FileList
}

function createDragEvent(init: TestDragEventInit = {}): DragEvent {
  const dataTransfer = {
    types: init.types ?? [],
    getData: (type: string) => (type === 'application/json' ? (init.jsonData ?? '') : ''),
    files: init.files,
  }

  return {
    preventDefault: vi.fn(),
    dataTransfer,
  } as unknown as DragEvent
}

describe('usePageGridFileDrop', () => {
  function createHarness() {
    const callbacks = {
      onFilesDropped: vi.fn(),
      onSourceDropped: vi.fn(),
      onSourcePageDropped: vi.fn(),
      onSourcePagesDropped: vi.fn(),
    }
    const allowDropFiles = ref(true)
    const isDragging = ref(false)

    return {
      allowDropFiles,
      isDragging,
      callbacks,
      ...usePageGridFileDrop({
        allowDropFiles,
        isDragging,
        ...callbacks,
      }),
    }
  }

  it('tracks drag-over state with enter/leave counter', () => {
    const harness = createHarness()
    const enter = createDragEvent({ types: ['Files'] })
    const leave = createDragEvent()

    harness.handleFileDragEnter(enter)
    harness.handleFileDragEnter(enter)
    expect(harness.isFileDragOver.value).toBe(true)

    harness.handleFileDragLeave(leave)
    expect(harness.isFileDragOver.value).toBe(true)

    harness.handleFileDragLeave(leave)
    expect(harness.isFileDragOver.value).toBe(false)
  })

  it('handles source payloads before falling back to files', async () => {
    const harness = createHarness()

    await harness.handleFileDrop(
      createDragEvent({
        jsonData: JSON.stringify({ type: 'source-file', sourceId: 'source-1' }),
      }),
    )
    expect(harness.callbacks.onSourceDropped).toHaveBeenCalledWith('source-1')

    await harness.handleFileDrop(
      createDragEvent({
        jsonData: JSON.stringify({ type: 'source-page', sourceId: 'source-1', pageIndex: 2 }),
      }),
    )
    expect(harness.callbacks.onSourcePageDropped).toHaveBeenCalledWith('source-1', 2)

    await harness.handleFileDrop(
      createDragEvent({
        jsonData: JSON.stringify({ type: 'source-pages', sourceId: 'source-1', pages: [1, 3] }),
      }),
    )
    expect(harness.callbacks.onSourcePagesDropped).toHaveBeenCalledWith([
      { sourceId: 'source-1', pageIndex: 1 },
      { sourceId: 'source-1', pageIndex: 3 },
    ])
  })

  it('ignores drops when disabled and forwards raw files when enabled', async () => {
    const harness = createHarness()
    harness.allowDropFiles.value = false

    await harness.handleFileDrop(createDragEvent({ types: ['Files'] }))
    expect(harness.callbacks.onFilesDropped).not.toHaveBeenCalled()

    harness.allowDropFiles.value = true
    const files = { length: 1 } as FileList
    await harness.handleFileDrop(createDragEvent({ files }))
    expect(harness.callbacks.onFilesDropped).toHaveBeenCalledWith(files)
  })
})

