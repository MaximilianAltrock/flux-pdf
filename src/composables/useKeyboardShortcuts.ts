import { onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { RotatePagesCommand } from '@/commands'

export function useKeyboardShortcuts(emitCommandPalette: () => void) {
  const store = useDocumentStore()
  const { undo, redo, execute } = useCommandManager()

  function handleKeydown(e: KeyboardEvent) {
    // Ignore if typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return
    }

    const isCmd = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey

    // Command Palette: Cmd+K or /
    if ((isCmd && e.key === 'k') || e.key === '/') {
      e.preventDefault()
      emitCommandPalette()
      return
    }

    // Tools
    if (e.key === 'v') {
      store.currentTool = 'select'
    } else if (e.key === 'c') {
      store.currentTool = 'razor'
    }

    // Undo/Redo
    if (isCmd && e.key === 'z') {
      e.preventDefault()
      if (isShift) {
        redo()
      } else {
        undo()
      }
      return
    }

    // Deletion
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (store.selectedCount > 0) {
        e.preventDefault()
        store.softDeletePages(Array.from(store.selection.selectedIds))
      }
      return
    }

    // Select All
    if (isCmd && e.key === 'a') {
      e.preventDefault()
      store.selectAll()
      return
    }

    // Deselect
    if (e.key === 'Escape') {
      store.clearSelection()
      return
    }

    // Rotation
    if (e.key.toLowerCase() === 'r') {
      if (store.selectedCount > 0) {
         e.preventDefault()
         const degrees = isShift ? -90 : 90
         execute(new RotatePagesCommand(Array.from(store.selection.selectedIds), degrees))
      }
    }

    // Arrow Navigation (Simple implementation)
    // For full grid navigation, we'd need to know the grid layout dimensions.
    // Here we just implementing "Next/Prev" logic based on selection index.
    if (['ArrowLeft', 'ArrowRight'].includes(e.key) && store.selection.lastSelectedId) {
      e.preventDefault()
      const allPages = store.pages // This includes deleted ones? store.pages is all.
      const index = allPages.findIndex(p => p.id === store.selection.lastSelectedId)

      if (index === -1) return

      let newIndex = index
      if (e.key === 'ArrowLeft') newIndex = Math.max(0, index - 1)
      if (e.key === 'ArrowRight') newIndex = Math.min(allPages.length - 1, index + 1)

      const newPage = allPages[newIndex]
      if (newPage) {
        if (isShift) {
           store.selectRange(store.selection.lastSelectedId, newPage.id)
        } else {
           store.selectPage(newPage.id, false)
        }
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
