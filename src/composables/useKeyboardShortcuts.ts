import { onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { UserAction } from '@/types/actions'

export function useKeyboardShortcuts(handleAction: (action: string) => void) {
  const store = useDocumentStore()
  const { undo, redo } = useCommandManager()

  function handleKeydown(e: KeyboardEvent) {
    // Ignore if typing in an input
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return
    }

    const isCmd = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey

    // Command Palette: Cmd+K or /
    if ((isCmd && e.key === 'k') || e.key === '/') {
      e.preventDefault()
      handleAction(UserAction.OPEN_COMMAND_PALETTE)
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

    if (store.selectedCount > 0) {
      // ----------------------------------------------------
      // 1. STANDARD DUPLICATE (Cmd + D)
      // ----------------------------------------------------
      // Using standard convention avoids confusion.
      if (isCmd && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleAction(UserAction.DUPLICATE)
        return
      }

      // ----------------------------------------------------
      // 2. DELETE (Backspace / Delete)
      // ----------------------------------------------------
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        handleAction(UserAction.DELETE) // Delegate to handler
        return
      }

      // ----------------------------------------------------
      // 3. DIFF MODE (D)
      // ----------------------------------------------------
      // 'D' always tries to Diff. It never Duplicates.
      // Deterministic behavior is better than "smart" behavior.
      if (e.key.toLowerCase() === 'd' && !isCmd) {
        e.preventDefault()
        // We trigger the action regardless of count.
        // The Action Handler (useAppActions) is responsible for
        // checking the count and showing a Toast error if != 2.
        handleAction(UserAction.DIFF)
        return
      }
      // ----------------------------------------------------
      // ROTATE (R)
      // ----------------------------------------------------
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        // Delegate to the Action Handler
        if (e.shiftKey) {
          handleAction(UserAction.ROTATE_LEFT)
        } else {
          handleAction(UserAction.ROTATE_RIGHT)
        }
        return
      }
    }

    // Arrow Navigation (Simple implementation)
    // For full grid navigation, we'd need to know the grid layout dimensions.
    // Here we just implementing "Next/Prev" logic based on selection index.
    if (['ArrowLeft', 'ArrowRight'].includes(e.key) && store.selection.lastSelectedId) {
      e.preventDefault()
      const allPages = store.pages
      const index = allPages.findIndex((p) => p.id === store.selection.lastSelectedId)

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
