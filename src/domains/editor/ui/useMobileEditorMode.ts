import { computed, toRef, type MaybeRefOrGetter } from 'vue'
import type { EditorToolId, MobileEditorMode } from '@/domains/editor/domain/types'

export function useMobileEditorMode(
  mobileMode: MaybeRefOrGetter<MobileEditorMode>,
  currentTool: MaybeRefOrGetter<EditorToolId>,
) {
  const mode = toRef(mobileMode)
  const tool = toRef(currentTool)

  const isSplit = computed(() => tool.value === 'razor')
  const isBrowse = computed(() => mode.value === 'browse' && !isSplit.value)
  const isSelect = computed(() => mode.value === 'select')
  const isMove = computed(() => mode.value === 'move')

  return {
    mode,
    isSplit,
    isBrowse,
    isSelect,
    isMove,
  }
}
