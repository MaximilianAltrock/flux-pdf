import { ref, watch, computed } from 'vue'
import type { DividerReference, PageEntry, PageReference } from '@/types'
import { isDividerEntry, isPageEntry } from '@/types'

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

  const gridItems = computed<GridItem[]>(() => {
    const items: GridItem[] = []
    const pages = localPages.value

    for (let index = 0; index < pages.length; index++) {
      const entry = pages[index]
      if (!entry) continue

      if (isDividerEntry(entry)) {
        items.push({
          kind: 'divider',
          id: entry.id,
          entry,
          index,
          dragLabel: 'Section divider',
        })
        continue
      }

      const pageNumber = contentPageNumberMap.value.get(entry.id) ?? 0
      const prev = pages[index - 1]
      let isStartOfFile = false
      if (index === 0) {
        isStartOfFile = true
      } else if (prev && !isDividerEntry(prev)) {
        isStartOfFile = entry.groupId !== (prev as PageReference).groupId
      }

      items.push({
        kind: 'page',
        id: entry.id,
        entry,
        index,
        pageNumber,
        dragLabel: `Page ${pageNumber}`,
        isStartOfFile,
      })
    }

    return items
  })

  return {
    localPages,
    isDragging,
    isSelected,
    contentPages,
    getContentPageNumber,
    gridItems,
  }
}

export type GridItem =
  | {
      kind: 'divider'
      id: string
      entry: DividerReference
      index: number
      dragLabel: string
    }
  | {
      kind: 'page'
      id: string
      entry: PageReference
      index: number
      pageNumber: number
      dragLabel: string
      isStartOfFile: boolean
    }
