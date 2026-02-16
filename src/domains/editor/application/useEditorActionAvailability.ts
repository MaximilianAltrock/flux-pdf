import { computed } from 'vue'
import { DIFF_REQUIRED_SELECTION } from '@/shared/constants'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { UserAction } from '@/shared/types/actions'

export function useEditorActionAvailability() {
  const document = useDocumentStore()

  const hasPages = computed(() => document.pageCount > 0)
  const hasSelection = computed(() => document.selectedCount > 0)
  const hasSingleSelection = computed(() => document.selectedCount === 1)
  const hasDiffSelection = computed(
    () => document.selectedCount === DIFF_REQUIRED_SELECTION,
  )

  function canRun(action: UserAction): boolean {
    switch (action) {
      case UserAction.EXPORT:
      case UserAction.SELECT_ALL:
        return hasPages.value
      case UserAction.EXPORT_SELECTED:
      case UserAction.DELETE:
      case UserAction.DUPLICATE:
      case UserAction.ROTATE_LEFT:
      case UserAction.ROTATE_RIGHT:
        return hasSelection.value
      case UserAction.DIFF:
        return hasDiffSelection.value
      case UserAction.PREVIEW:
        return hasSingleSelection.value
      case UserAction.ADD_FILES:
      case UserAction.NEW_PROJECT:
      case UserAction.OPEN_COMMAND_PALETTE:
        return true
      default:
        return true
    }
  }

  return {
    hasPages,
    hasSelection,
    hasSingleSelection,
    hasDiffSelection,
    canRun,
  }
}

