import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useMobileEditorMode } from '@/domains/editor/ui/useMobileEditorMode'

describe('useMobileEditorMode', () => {
  it('treats razor tool as split mode and disables browse flag', () => {
    const mobileMode = ref<'browse' | 'select' | 'move'>('browse')
    const currentTool = ref<'select' | 'razor'>('razor')
    const state = useMobileEditorMode(mobileMode, currentTool)

    expect(state.isSplit.value).toBe(true)
    expect(state.isBrowse.value).toBe(false)
    expect(state.isSelect.value).toBe(false)
    expect(state.isMove.value).toBe(false)
  })

  it('maps mobile mode flags when the active tool is select', () => {
    const mobileMode = ref<'browse' | 'select' | 'move'>('select')
    const currentTool = ref<'select' | 'razor'>('select')
    const state = useMobileEditorMode(mobileMode, currentTool)

    expect(state.isSplit.value).toBe(false)
    expect(state.isBrowse.value).toBe(false)
    expect(state.isSelect.value).toBe(true)
    expect(state.isMove.value).toBe(false)
  })

  it('updates reactively when mode and tool change', () => {
    const mobileMode = ref<'browse' | 'select' | 'move'>('browse')
    const currentTool = ref<'select' | 'razor'>('select')
    const state = useMobileEditorMode(mobileMode, currentTool)

    expect(state.isBrowse.value).toBe(true)

    mobileMode.value = 'move'
    expect(state.isMove.value).toBe(true)

    currentTool.value = 'razor'
    expect(state.isSplit.value).toBe(true)
    expect(state.isBrowse.value).toBe(false)
  })
})

