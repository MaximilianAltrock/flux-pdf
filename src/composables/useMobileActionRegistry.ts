import { computed, type Component, markRaw } from 'vue'
import {
  ArrowRightLeft,
  RotateCw,
  Copy,
  Trash2,
  Download,
  CheckSquare,
  XSquare,
} from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { type RotationDelta } from '@/constants'

/**
 * Mobile action categories for grouping in the "More" action sheet
 */
export type MobileActionCategory = 'arrange' | 'export' | 'utilities'

/**
 * Definition of a mobile action for the bottom bar or action sheet
 */
export interface MobileAction {
  id: string
  label: string
  icon: Component
  /** Primary actions appear in the bottom bar, secondary in "More" sheet */
  primary?: boolean
  /** Category for grouping in the action sheet */
  category?: MobileActionCategory
  /** Whether action is destructive (styled differently) */
  isDestructive?: boolean
  /** Function to execute the action */
  execute: () => void
  /** Function to check if action is enabled (defaults to true) */
  isEnabled?: () => boolean
  /** Function to check if action is visible (defaults to true) */
  isVisible?: () => boolean
}

/**
 * Creates a mobile action registry bound to app actions
 *
 * Usage:
 * const { primaryActions, secondaryActions, groupedSecondaryActions } = useMobileActionRegistry(actions)
 */
export function useMobileActionRegistry(actions: {
  enterMobileMoveMode: () => void
  handleRotateSelected: (degrees: RotationDelta) => void
  handleDuplicateSelected: () => void
  handleDeleteSelected: () => void
  handleExportSelected: () => void
  selectAllPages: () => void
  clearSelection: () => void
}) {
  const store = useDocumentStore()

  // Define all mobile selection actions
  const allActions: MobileAction[] = [
    // === Primary Actions (Bottom Bar) ===
    {
      id: 'move',
      label: 'Move',
      icon: markRaw(ArrowRightLeft),
      primary: true,
      execute: () => actions.enterMobileMoveMode(),
      isEnabled: () => store.selectedCount > 0,
    },
    {
      id: 'rotate',
      label: 'Rotate',
      icon: markRaw(RotateCw),
      primary: true,
      execute: () => actions.handleRotateSelected(90),
      isEnabled: () => store.selectedCount > 0,
    },
    {
      id: 'duplicate',
      label: 'Copy',
      icon: markRaw(Copy),
      primary: true,
      execute: () => actions.handleDuplicateSelected(),
      isEnabled: () => store.selectedCount > 0,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: markRaw(Trash2),
      primary: true,
      isDestructive: true,
      execute: () => actions.handleDeleteSelected(),
      isEnabled: () => store.selectedCount > 0,
    },

    // === Secondary Actions (More Sheet) ===
    {
      id: 'export-selected',
      label: 'Export Selected',
      icon: markRaw(Download),
      category: 'export',
      execute: () => actions.handleExportSelected(),
      isEnabled: () => store.selectedCount > 0,
    },
    {
      id: 'select-all',
      label: 'Select All',
      icon: markRaw(CheckSquare),
      category: 'utilities',
      execute: () => actions.selectAllPages(),
      isVisible: () => store.pageCount > store.selectedCount,
    },
    {
      id: 'deselect-all',
      label: 'Deselect All',
      icon: markRaw(XSquare),
      category: 'utilities',
      execute: () => actions.clearSelection(),
      isVisible: () => store.selectedCount > 0,
    },
  ]

  // Computed: Primary actions for bottom bar
  const primaryActions = computed(() =>
    allActions
      .filter((a) => a.primary)
      .filter((a) => a.isVisible?.() !== false)
      .map((a) => ({
        ...a,
        disabled: a.isEnabled ? !a.isEnabled() : false,
      })),
  )

  // Computed: Secondary actions for "More" sheet
  const secondaryActions = computed(() =>
    allActions
      .filter((a) => !a.primary)
      .filter((a) => a.isVisible?.() !== false)
      .map((a) => ({
        ...a,
        disabled: a.isEnabled ? !a.isEnabled() : false,
      })),
  )

  // Computed: Secondary actions grouped by category
  const groupedSecondaryActions = computed(() => {
    const groups: Record<MobileActionCategory, typeof secondaryActions.value> = {
      arrange: [],
      export: [],
      utilities: [],
    }

    for (const action of secondaryActions.value) {
      const category = action.category ?? 'utilities'
      groups[category].push(action)
    }

    // Return only non-empty groups
    return Object.entries(groups)
      .filter(([, actions]) => actions.length > 0)
      .map(([category, actions]) => ({
        category: category as MobileActionCategory,
        label: getCategoryLabel(category as MobileActionCategory),
        actions,
      }))
  })

  return {
    primaryActions,
    secondaryActions,
    groupedSecondaryActions,
  }
}

function getCategoryLabel(category: MobileActionCategory): string {
  switch (category) {
    case 'arrange':
      return 'Arrange'
    case 'export':
      return 'Export'
    case 'utilities':
      return 'Utilities'
  }
}
