import { computed } from 'vue'
import { useUiStore } from '@/domains/editor/store/ui.store'
import type { EditorToolId } from '@/domains/editor/domain/types'

export type GridInteractionPolicy = {
  tool: EditorToolId
  allowDrag: boolean
  allowDropFiles: boolean
  allowContextMenu: boolean
  allowThumbnailActions: boolean
  allowSelection: boolean
  showHoverEffects: boolean
}

const TOOL_POLICIES: Record<EditorToolId, Omit<GridInteractionPolicy, 'tool'>> = {
  select: {
    allowDrag: true,
    allowDropFiles: true,
    allowContextMenu: true,
    allowThumbnailActions: true,
    allowSelection: true,
    showHoverEffects: true,
  },
  razor: {
    allowDrag: true,
    allowDropFiles: true,
    allowContextMenu: true,
    allowThumbnailActions: false,
    allowSelection: true,
    showHoverEffects: true,
  },
  target: {
    allowDrag: false,
    allowDropFiles: false,
    allowContextMenu: false,
    allowThumbnailActions: false,
    allowSelection: false,
    showHoverEffects: false,
  },
}

export function useGridInteractionPolicy() {
  const ui = useUiStore()

  const isInteractionBlocked = computed(() => ui.hasOpenModal || ui.isLoading)

  const policy = computed<GridInteractionPolicy>(() => ({
    tool: ui.currentTool,
    ...TOOL_POLICIES[ui.currentTool],
    ...(isInteractionBlocked.value
      ? {
          allowDrag: false,
          allowDropFiles: false,
          allowContextMenu: false,
          allowThumbnailActions: false,
          allowSelection: false,
          showHoverEffects: false,
        }
      : {}),
  }))

  return { policy }
}

