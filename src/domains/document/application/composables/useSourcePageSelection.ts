import { ref, shallowRef, toRef, type MaybeRefOrGetter } from 'vue'

export function useSourcePageSelection(sourceId: MaybeRefOrGetter<string>) {
  const sourceIdRef = toRef(sourceId)

  const selectedPages = ref<Set<number>>(new Set())
  const lastSelectedIndex = shallowRef<number | null>(null)

  function clearSelection() {
    selectedPages.value = new Set()
    lastSelectedIndex.value = null
  }

  function selectSingle(index: number) {
    selectedPages.value = new Set([index])
    lastSelectedIndex.value = index
  }

  function toggleSelection(index: number) {
    const next = new Set(selectedPages.value)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    selectedPages.value = next
    lastSelectedIndex.value = index
  }

  function selectRange(index: number) {
    if (lastSelectedIndex.value === null) {
      selectSingle(index)
      return
    }
    const next = new Set<number>()
    const start = Math.min(lastSelectedIndex.value, index)
    const end = Math.max(lastSelectedIndex.value, index)
    for (let i = start; i <= end; i += 1) {
      next.add(i)
    }
    selectedPages.value = next
  }

  function handlePageClick(event: MouseEvent, index: number) {
    if (event.metaKey || event.ctrlKey) {
      toggleSelection(index)
      return
    }
    if (event.shiftKey) {
      selectRange(index)
      return
    }
    selectSingle(index)
  }

  function handlePageDragStart(event: DragEvent, index: number) {
    if (!selectedPages.value.has(index)) {
      selectSingle(index)
    }
    const selected = Array.from(selectedPages.value).sort((a, b) => a - b)

    if (event.dataTransfer) {
      const sourceIdValue = sourceIdRef.value
      event.dataTransfer.effectAllowed = 'copy'
      if (selected.length > 1) {
        const payload = { type: 'source-pages', sourceId: sourceIdValue, pages: selected }
        event.dataTransfer.setData('application/x-flux-source-pages', JSON.stringify(payload))
        event.dataTransfer.setData('application/json', JSON.stringify(payload))
      } else {
        const pageIndex = selected[0] ?? index
        event.dataTransfer.setData(
          'application/x-flux-source-page',
          `${sourceIdValue}:${pageIndex}`,
        )
        event.dataTransfer.setData(
          'application/json',
          JSON.stringify({ type: 'source-page', sourceId: sourceIdValue, pageIndex }),
        )
      }
    }
  }

  return {
    selectedPages,
    lastSelectedIndex,
    clearSelection,
    handlePageClick,
    handlePageDragStart,
  }
}
