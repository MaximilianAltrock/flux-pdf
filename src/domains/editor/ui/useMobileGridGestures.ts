import { computed, shallowRef, toRef, type MaybeRefOrGetter } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { FEATURE_FLAGS } from '@/shared/constants'

type HapticFeedback = (style: 'light' | 'medium') => void

type UseMobileGridGesturesOptions = {
  isBrowse: MaybeRefOrGetter<boolean>
  isMove: MaybeRefOrGetter<boolean>
  isSplit: MaybeRefOrGetter<boolean>
  onLongPressPage: (pageId: string) => void
  haptic: HapticFeedback
  minColumns?: number
  maxColumns?: number
}

const LONG_PRESS_MS = 400
const PINCH_DELTA_THRESHOLD = 80
const DEFAULT_MIN_COLUMNS = 2
const DEFAULT_MAX_COLUMNS = 4

export function useMobileGridGestures(options: UseMobileGridGesturesOptions) {
  const isBrowseRef = toRef(options.isBrowse)
  const isMoveRef = toRef(options.isMove)
  const isSplitRef = toRef(options.isSplit)

  const minColumns = options.minColumns ?? DEFAULT_MIN_COLUMNS
  const maxColumns = options.maxColumns ?? DEFAULT_MAX_COLUMNS

  const columnCount = shallowRef(minColumns)
  const longPressPageId = shallowRef<string | null>(null)

  const { start: startLongPress, stop: stopLongPress } = useTimeoutFn(
    () => {
      const pageId = longPressPageId.value
      if (!pageId) return
      options.haptic('medium')
      options.onLongPressPage(pageId)
      longPressPageId.value = null
    },
    LONG_PRESS_MS,
    { immediate: false },
  )

  const pinchStartDistance = shallowRef(0)
  const isPinching = shallowRef(false)

  const gridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${columnCount.value}, 1fr)`,
  }))

  function clearLongPress() {
    stopLongPress()
    longPressPageId.value = null
  }

  function handleTouchStart(pageId: string) {
    if (isMoveRef.value || isSplitRef.value) return
    if (!isBrowseRef.value) return
    longPressPageId.value = pageId
    startLongPress()
  }

  function handleTouchMove() {
    clearLongPress()
  }

  function handleTouchEnd() {
    clearLongPress()
  }

  function handlePinchStart(event: TouchEvent) {
    if (event.touches.length !== 2) return

    isPinching.value = true

    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]
    if (!firstTouch || !secondTouch) return

    pinchStartDistance.value = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    )
  }

  function handlePinchMove(event: TouchEvent) {
    if (!isPinching.value || event.touches.length !== 2) return
    if (event.cancelable) event.preventDefault()

    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]
    if (!firstTouch || !secondTouch) return

    const currentDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    )
    const delta = currentDistance - pinchStartDistance.value

    if (Math.abs(delta) <= PINCH_DELTA_THRESHOLD) return

    if (delta > 0 && columnCount.value > minColumns) {
      columnCount.value -= 1
      options.haptic('light')
      pinchStartDistance.value = currentDistance
      return
    }

    if (delta < 0 && columnCount.value < maxColumns) {
      columnCount.value += 1
      options.haptic('light')
      pinchStartDistance.value = currentDistance
    }
  }

  function handlePinchEnd() {
    isPinching.value = false
  }

  if (typeof window !== 'undefined' && FEATURE_FLAGS.ENABLE_MOBILE_PINCH_GRID_ZOOM) {
    useEventListener(window, 'touchstart', handlePinchStart, { passive: false })
    useEventListener(window, 'touchmove', handlePinchMove, { passive: false })
    useEventListener(window, 'touchend', handlePinchEnd)
  }

  return {
    gridStyle,
    longPressPageId,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
