import { ref, watch, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import type { PageEntry } from '@/types'

export function useGridLogic() {
  const store = useDocumentStore()

  // Local state for drag-and-drop
  // We use this as the v-model for the draggable library
  const localPages = ref<PageEntry[]>([])
  const isDragging = ref(false)

  // Sync with store (One-way sync: Store -> Local)
  // We stop syncing while dragging to prevent stutter
  watch(
    () => store.pages,
    (newPages) => {
      if (!isDragging.value) {
        localPages.value = [...newPages]
      }
    },
    { deep: true, immediate: true },
  )

  // Helpers
  const isSelected = (id: string) => store.selection.selectedIds.has(id)

  // In the new Hard Delete architecture, all pages in store are visible
  // But we still filter out Dividers for page counting contexts usually
  const visiblePages = computed(() => localPages.value)

  return {
    localPages,
    isDragging,
    isSelected,
    visiblePages,
    store,
  }
}
