import { computed, type Component, markRaw } from 'vue'
import {
  ArrowRightLeft,
  RotateCw,
  RotateCcw,
  Copy,
  Trash2,
  Download,
  Scissors,
} from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { ROTATION_DELTA_DEGREES, type RotationDelta } from '@/constants'
import { isDividerEntry } from '@/types'

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
  enterMobileSplitMode: () => void
  handleRotateSelected: (degrees: RotationDelta) => void
  handleDuplicateSelected: () => void
  handleDeleteSelected: () => void
  handleExportSelected: () => void
}) {
  const store = useDocumentStore()
  const canSplit = computed(() => {
    const pages = store.pages
    if (pages.length < 2) return false
    for (let i = 1; i < pages.length; i++) {
      const prev = pages[i - 1]
      const next = pages[i]
      if (!prev || !next) continue
      if (!isDividerEntry(prev) && !isDividerEntry(next)) return true
    }
    return false
  })

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
      execute: () => actions.handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT),
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
      id: 'split',
      label: 'Split',
      icon: markRaw(Scissors),
      category: 'arrange',
      execute: () => actions.enterMobileSplitMode(),
      isEnabled: () => canSplit.value,
      isVisible: () => canSplit.value,
    },
    {
      id: 'rotate-left',
      label: 'Rotate Left',
      icon: markRaw(RotateCcw),
      category: 'arrange',
      execute: () => actions.handleRotateSelected(ROTATION_DELTA_DEGREES.LEFT),
      isEnabled: () => store.selectedCount > 0,
    },
    {
      id: 'export-selected',
      label: 'Export Selected',
      icon: markRaw(Download),
      category: 'export',
      execute: () => actions.handleExportSelected(),
      isEnabled: () => store.selectedCount > 0,
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
