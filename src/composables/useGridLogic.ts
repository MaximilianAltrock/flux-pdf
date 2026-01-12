import { ref, watch, computed } from 'vue'
import type { PageEntry, PageReference } from '@/types'
import { isPageEntry } from '@/types'

type GridDocument = {
  pages: ReadonlyArray<PageEntry>
  selectedIds: ReadonlySet<string>
}

export function useGridLogic(document: GridDocument) {
  // Local state for drag-and-drop
  // We use this as the v-model for the draggable library
  const localPages = ref<PageEntry[]>([])
  const isDragging = ref(false)

  // Sync with store (One-way sync: Store -> Local)
  // We stop syncing while dragging to prevent stutter
  watch(
    () => document.pages,
    (newPages) => {
      if (!isDragging.value) {
        localPages.value = [...newPages]
      }
    },
    { deep: true, immediate: true },
  )

  // Helpers
  const isSelected = (id: string) => document.selectedIds.has(id)

  // In the new Hard Delete architecture, all pages in store are visible
  // But we still filter out Dividers for page counting contexts usually
  const contentPages = computed(() =>
    localPages.value.filter((page): page is PageReference => isPageEntry(page)),
  )
  const contentPageNumberMap = computed(() => {
    const map = new Map<string, number>()
    contentPages.value.forEach((page, index) => {
      map.set(page.id, index + 1)
    })
    return map
  })

  const getContentPageNumber = (pageId: string): number =>
    contentPageNumberMap.value.get(pageId) ?? 0

  return {
    localPages,
    isDragging,
    isSelected,
    contentPages,
    getContentPageNumber,
  }
}
