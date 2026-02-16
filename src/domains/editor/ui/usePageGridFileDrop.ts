import { shallowRef, toRef, type MaybeRefOrGetter } from 'vue'

export type SourcePageDrop = {
  sourceId: string
  pageIndex: number
}

type PageGridFileDropCallbacks = {
  onFilesDropped: (files: FileList) => void
  onSourceDropped: (sourceId: string) => void
  onSourcePageDropped: (sourceId: string, pageIndex: number) => void
  onSourcePagesDropped: (pages: SourcePageDrop[]) => void
}

export type UsePageGridFileDropOptions = {
  allowDropFiles: MaybeRefOrGetter<boolean>
  isDragging: MaybeRefOrGetter<boolean>
} & PageGridFileDropCallbacks

type SourceFilePayload = {
  type: 'source-file'
  sourceId: string
}

type SourcePagePayload = {
  type: 'source-page'
  sourceId: string
  pageIndex: number
}

type SourcePagesPayload = {
  type: 'source-pages'
  sourceId: string
  pages: number[]
}

function isSourcePageDrop(value: unknown): value is SourcePageDrop {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'sourceId' in value &&
      typeof value.sourceId === 'string' &&
      'pageIndex' in value &&
      Number.isInteger(value.pageIndex),
  )
}

export function usePageGridFileDrop(options: UsePageGridFileDropOptions) {
  const allowDropFilesRef = toRef(options.allowDropFiles)
  const isDraggingRef = toRef(options.isDragging)

  const isFileDragOver = shallowRef(false)
  const dragCounter = shallowRef(0)

  function resetFileDragState() {
    dragCounter.value = 0
    isFileDragOver.value = false
  }

  function handleFileDragEnter(event: DragEvent) {
    event.preventDefault()
    if (!allowDropFilesRef.value) return
    if (isDraggingRef.value) return

    const types = event.dataTransfer?.types
    if (types?.includes('Files') || types?.includes('application/json')) {
      dragCounter.value += 1
      isFileDragOver.value = true
    }
  }

  function handleFileDragOver(event: DragEvent) {
    event.preventDefault()
  }

  function handleFileDragLeave(event: DragEvent) {
    event.preventDefault()
    if (!allowDropFilesRef.value) return
    if (isDraggingRef.value) return

    dragCounter.value -= 1
    if (dragCounter.value <= 0) {
      resetFileDragState()
    }
  }

  async function handleFileDrop(event: DragEvent) {
    event.preventDefault()
    if (!allowDropFilesRef.value) return
    resetFileDragState()
    if (isDraggingRef.value) return

    const rawPayload = event.dataTransfer?.getData('application/json')
    if (rawPayload) {
      try {
        const payload: unknown = JSON.parse(rawPayload)
        if (payload && typeof payload === 'object' && 'type' in payload) {
          if ((payload as SourceFilePayload).type === 'source-file') {
            const sourcePayload = payload as SourceFilePayload
            if (sourcePayload.sourceId) {
              options.onSourceDropped(sourcePayload.sourceId)
              return
            }
          }
          if ((payload as SourcePagePayload).type === 'source-page') {
            const pagePayload = payload as SourcePagePayload
            if (pagePayload.sourceId && Number.isInteger(pagePayload.pageIndex)) {
              options.onSourcePageDropped(pagePayload.sourceId, pagePayload.pageIndex)
              return
            }
          }
          if ((payload as SourcePagesPayload).type === 'source-pages') {
            const pagesPayload = payload as SourcePagesPayload
            if (pagesPayload.sourceId && Array.isArray(pagesPayload.pages)) {
              const pages = pagesPayload.pages
                .map((pageIndex) => ({ sourceId: pagesPayload.sourceId, pageIndex }))
                .filter(isSourcePageDrop)
              if (pages.length > 0) {
                options.onSourcePagesDropped(pages)
                return
              }
            }
          }
        }
      } catch {
        // ignore malformed payload
      }
    }

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      options.onFilesDropped(files)
    }
  }

  return {
    isFileDragOver,
    handleFileDragEnter,
    handleFileDragOver,
    handleFileDragLeave,
    handleFileDrop,
    resetFileDragState,
  }
}
