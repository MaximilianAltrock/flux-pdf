import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { useMobileGridGestures } from '@/domains/editor/ui/useMobileGridGestures'

function createTouchEvent(
  type: 'touchstart' | 'touchmove',
  touches: Array<{ clientX: number; clientY: number }>,
  cancelable = false,
) {
  const event = new window.Event(type, { cancelable })
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true,
  })
  return event as unknown as TouchEvent
}

type GestureHarness = ReturnType<typeof useMobileGridGestures>

describe('useMobileGridGestures', () => {
  const scopes: EffectScope[] = []

  afterEach(() => {
    while (scopes.length > 0) {
      scopes.pop()?.stop()
    }
    vi.useRealTimers()
  })

  function createHarness(options?: {
    isBrowse?: boolean
    isMove?: boolean
    isSplit?: boolean
    minColumns?: number
    maxColumns?: number
  }) {
    const isBrowse = ref(options?.isBrowse ?? true)
    const isMove = ref(options?.isMove ?? false)
    const isSplit = ref(options?.isSplit ?? false)
    const onLongPressPage = vi.fn()
    const haptic = vi.fn()

    const scope = effectScope()
    const gestures = scope.run((): GestureHarness =>
      useMobileGridGestures({
        isBrowse,
        isMove,
        isSplit,
        onLongPressPage,
        haptic,
        minColumns: options?.minColumns,
        maxColumns: options?.maxColumns,
      }),
    )
    if (!gestures) {
      throw new Error('Failed to create useMobileGridGestures harness')
    }
    scopes.push(scope)

    return {
      gestures,
      onLongPressPage,
      haptic,
    }
  }

  it('fires long-press callback after threshold and clears highlight state', () => {
    vi.useFakeTimers()
    const { gestures, onLongPressPage, haptic } = createHarness()

    gestures.handleTouchStart('page-1')
    expect(gestures.longPressPageId.value).toBe('page-1')

    vi.advanceTimersByTime(399)
    expect(onLongPressPage).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onLongPressPage).toHaveBeenCalledWith('page-1')
    expect(haptic).toHaveBeenCalledWith('medium')
    expect(gestures.longPressPageId.value).toBeNull()
  })

  it('cancels pending long-press on touch move and touch end', () => {
    vi.useFakeTimers()
    const { gestures, onLongPressPage } = createHarness()

    gestures.handleTouchStart('page-1')
    gestures.handleTouchMove()
    vi.advanceTimersByTime(450)
    expect(onLongPressPage).not.toHaveBeenCalled()

    gestures.handleTouchStart('page-2')
    gestures.handleTouchEnd()
    vi.advanceTimersByTime(450)
    expect(onLongPressPage).not.toHaveBeenCalled()
    expect(gestures.longPressPageId.value).toBeNull()
  })

  it('ignores long-press when browse mode is inactive or blocked by move/split modes', () => {
    vi.useFakeTimers()
    const blockedByMode = createHarness({ isBrowse: false })
    blockedByMode.gestures.handleTouchStart('page-1')
    vi.advanceTimersByTime(450)
    expect(blockedByMode.onLongPressPage).not.toHaveBeenCalled()

    const blockedByMove = createHarness({ isMove: true })
    blockedByMove.gestures.handleTouchStart('page-2')
    vi.advanceTimersByTime(450)
    expect(blockedByMove.onLongPressPage).not.toHaveBeenCalled()

    const blockedBySplit = createHarness({ isSplit: true })
    blockedBySplit.gestures.handleTouchStart('page-3')
    vi.advanceTimersByTime(450)
    expect(blockedBySplit.onLongPressPage).not.toHaveBeenCalled()
  })

  it('updates column count on pinch gestures and triggers light haptics', () => {
    const { gestures, haptic } = createHarness({ minColumns: 1, maxColumns: 3 })

    const pinchStart = createTouchEvent('touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
    ])
    window.dispatchEvent(pinchStart)

    const pinchIn = createTouchEvent(
      'touchmove',
      [
        { clientX: 0, clientY: 0 },
        { clientX: 10, clientY: 0 },
      ],
      true,
    )
    window.dispatchEvent(pinchIn)
    expect(gestures.gridStyle.value.gridTemplateColumns).toBe('repeat(2, 1fr)')

    const pinchOut = createTouchEvent(
      'touchmove',
      [
        { clientX: 0, clientY: 0 },
        { clientX: 110, clientY: 0 },
      ],
      true,
    )
    window.dispatchEvent(pinchOut)
    expect(gestures.gridStyle.value.gridTemplateColumns).toBe('repeat(1, 1fr)')

    expect(haptic).toHaveBeenCalledTimes(2)
    expect(haptic).toHaveBeenNthCalledWith(1, 'light')
    expect(haptic).toHaveBeenNthCalledWith(2, 'light')
  })
})

