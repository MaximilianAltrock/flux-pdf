import { onMounted, onUnmounted, type Ref } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { UserAction } from '@/types/actions'
import type { AppActions } from '@/composables/useAppActions'
import type { AppState } from '@/composables/useAppState'

type KeyboardShortcutOptions = {
  /** When true, all shortcuts are blocked (e.g., when a modal is open) */
  isModalOpen?: Ref<boolean>
}

export function useKeyboardShortcuts(
  actions: AppActions,
  state: AppState,
  options?: KeyboardShortcutOptions,
) {
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

    // Block all shortcuts when a modal is open (modals handle their own keys)
    if (options?.isModalOpen?.value) {
      return
    }

    const isCmd = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey

    // Command Palette: Cmd+K or /
    if ((isCmd && e.key === 'k') || e.key === '/') {
      e.preventDefault()
      state.openCommandPalette()
      return
    }

    // Tools
    if (e.key === 'v') {
      actions.setCurrentTool('select')
    } else if (e.key === 'c') {
      actions.setCurrentTool('razor')
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
      actions.selectAllPages()
      return
    }

    // Deselect (Escape)
    if (e.key === 'Escape') {
      actions.clearSelection()
      return
    }

    if (store.selectedCount > 0) {
      // ----------------------------------------------------
      // 1. STANDARD DUPLICATE (Cmd + D)
      // ----------------------------------------------------
      // Using standard convention avoids confusion.
      if (isCmd && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        actions.handleCommandAction(UserAction.DUPLICATE)
        return
      }

      // ----------------------------------------------------
      // 2. DELETE (Backspace / Delete)
      // ----------------------------------------------------
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        actions.handleCommandAction(UserAction.DELETE) // Delegate to handler
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
        actions.handleCommandAction(UserAction.DIFF)
        return
      }
      // ----------------------------------------------------
      // ROTATE (R)
      // ----------------------------------------------------
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        // Delegate to the Action Handler
        if (e.shiftKey) {
          actions.handleCommandAction(UserAction.ROTATE_LEFT)
        } else {
          actions.handleCommandAction(UserAction.ROTATE_RIGHT)
        }
        return
      }

      // ----------------------------------------------------
      // PREVIEW (Enter / Space)
      // ----------------------------------------------------
      // Open preview modal for the selected page (requires exactly 1 page)
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        actions.handleCommandAction(UserAction.PREVIEW)
        return
      }
    }

    // ============================================================
    // Home/End: Jump to first/last page
    // ============================================================
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const contentPages = store.contentPages
      if (contentPages.length === 0) return

      const targetPage = e.key === 'Home' ? contentPages[0] : contentPages[contentPages.length - 1]
      if (targetPage) {
        actions.selectPage(targetPage.id, false)
        requestAnimationFrame(() => {
          const thumbnail = document.querySelector(`[data-page-id="${targetPage.id}"]`)
          thumbnail?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
      return
    }

    //
    // Full Grid Arrow Navigation (Up/Down/Left/Right)
    // ============================================================
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()

      // Get content pages only (skip dividers for navigation)
      const contentPages = store.contentPages
      if (contentPages.length === 0) return

      // Find current index in content pages
      const currentId = store.selection.lastSelectedId
      const currentIndex = currentId
        ? contentPages.findIndex((p) => p.id === currentId)
        : -1

      // If nothing is selected, start from the first page
      if (currentIndex === -1) {
        actions.selectPage(contentPages[0]!.id, false)
        return
      }

      // Calculate grid columns based on container width and thumbnail size
      const gridContainer = document.querySelector('.grid.gap-4') as HTMLElement | null
      let columns = 4 // Default fallback
      if (gridContainer) {
        const containerWidth = gridContainer.clientWidth - 48 // Account for padding
        const thumbnailWidth = state.zoom.value + 20 + 16 // zoom + minmax offset + gap
        columns = Math.max(1, Math.floor(containerWidth / thumbnailWidth))
      }

      // Calculate new index based on arrow direction
      let newIndex = currentIndex
      switch (e.key) {
        case 'ArrowLeft':
          if (currentIndex > 0) {
            newIndex = currentIndex - 1
          }
          break
        case 'ArrowRight':
          if (currentIndex < contentPages.length - 1) {
            newIndex = currentIndex + 1
          }
          break
        case 'ArrowUp':
          // Only move up if there's a row above (index >= columns)
          if (currentIndex >= columns) {
            newIndex = currentIndex - columns
          }
          break
        case 'ArrowDown':
          // Only move down if the target would be a valid page
          if (currentIndex + columns < contentPages.length) {
            newIndex = currentIndex + columns
          }
          break
      }

      // Select the new page
      const newPage = contentPages[newIndex]
      if (newPage && newIndex !== currentIndex) {
        if (isShift) {
          actions.selectRange(currentId!, newPage.id)
        } else {
          actions.selectPage(newPage.id, false)
        }

        // Scroll the selected page into view
        requestAnimationFrame(() => {
          const thumbnail = document.querySelector(`[data-page-id="${newPage.id}"]`)
          thumbnail?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
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
