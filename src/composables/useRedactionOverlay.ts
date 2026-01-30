import { computed, ref, type Ref, watch } from 'vue'
import type { AppActions } from '@/composables/useAppActions'
import type { PageReference, RedactionMark } from '@/types'

// --- Types ---
type Size = { width: number; height: number }
type Point = { x: number; y: number }
type Rect = { left: number; top: number; width: number; height: number }
type Handle = 'nw' | 'ne' | 'sw' | 'se'
// DraftRect MUST include 'id'
type DraftRect = Rect & { id: string }

type UseRedactionOverlayOptions = {
  pageRef: Readonly<Ref<PageReference | null>>
  pageRedactions: Readonly<Ref<RedactionMark[]>>
  pageSize: Readonly<Ref<Size | null>>
  overlayRef: Readonly<Ref<HTMLDivElement | null>>
  overlayMetrics: Readonly<Ref<Rect>>
  actions: AppActions
  syncOverlayMetrics?: () => void
}

const REDACTION_MIN_SIZE_PX = 4
const REDACTION_CHANGE_EPSILON = 0.1

export function useRedactionOverlay(options: UseRedactionOverlayOptions) {
  const {
    pageRef,
    pageRedactions,
    pageSize,
    overlayRef,
    overlayMetrics,
    actions,
    syncOverlayMetrics,
  } = options

  // --- State ---
  const isRedactMode = ref(false)
  const isDrawing = ref(false)
  const interactionMode = ref<'draw' | 'move' | 'resize' | null>(null)
  const cachedBounds = ref<DOMRect | null>(null)

  // Selection
  const selectedIds = ref<Set<string>>(new Set())

  // Drag State
  const draggingId = ref<string | null>(null)
  const activeHandle = ref<Handle | null>(null)
  const dragStartPoint = ref<Point | null>(null)
  const dragStartRect = ref<Rect | null>(null)

  // FIX 1: Use DraftRect type so we can store the ID
  const draftRect = ref<DraftRect | null>(null)

  // Drawing State
  const drawStart = ref<Point | null>(null)
  const drawCurrent = ref<Point | null>(null)

  const redactionColor = ref<RedactionMark['color']>('black')

  // --- Computed ---

  const hasSelectedRedaction = computed(() => selectedIds.value.size > 0)

  const overlayScale = computed(() => {
    const size = pageSize.value
    const width = cachedBounds.value?.width || overlayMetrics.value.width || 1
    const height = cachedBounds.value?.height || overlayMetrics.value.height || 1
    if (!size || size.width <= 0) return { x: 1, y: 1 }
    return { x: width / size.width, y: height / size.height }
  })

  const drawingRect = computed(() => {
    if (!drawStart.value || !drawCurrent.value) return null
    return {
      left: Math.min(drawStart.value.x, drawCurrent.value.x),
      top: Math.min(drawStart.value.y, drawCurrent.value.y),
      width: Math.abs(drawStart.value.x - drawCurrent.value.x),
      height: Math.abs(drawStart.value.y - drawCurrent.value.y),
    }
  })

  // This was the unused variable
  const overlayCursor = computed(() => {
    if (!isRedactMode.value) return 'default'
    if (interactionMode.value === 'move') return 'grabbing'
    if (interactionMode.value === 'draw') return 'crosshair'
    return 'default'
  })

  // Watcher
  watch(pageRedactions, (next) => {
    if (!selectedIds.value.size) return
    const validIds = new Set(next.map((r) => r.id))
    for (const id of selectedIds.value) {
      if (!validIds.has(id)) selectedIds.value.delete(id)
    }
    if (draggingId.value && !validIds.has(draggingId.value)) {
      cancelInteraction()
    }
  })

  // --- Helpers ---

  function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val))
  }

  function getPoint(e: PointerEvent): Point {
    const rect = cachedBounds.value || overlayMetrics.value
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
    }
  }

  function toPdfRect(rect: Rect) {
    if (!pageRef.value || !pageSize.value) return null
    const s = overlayScale.value
    return {
      x: rect.left / s.x,
      y: rect.top / s.y,
      width: rect.width / s.x,
      height: rect.height / s.y,
    }
  }

  function getRedactionRect(redaction: RedactionMark): Rect {
    if (draftRect.value && draggingId.value === redaction.id) {
      return draftRect.value
    }
    const s = overlayScale.value
    return {
      left: redaction.x * s.x,
      top: redaction.y * s.y,
      width: redaction.width * s.x,
      height: redaction.height * s.y,
    }
  }

  function hasMeaningfulGeometryChange(prev: RedactionMark, next: RedactionMark): boolean {
    return (
      Math.abs(prev.x - next.x) > REDACTION_CHANGE_EPSILON ||
      Math.abs(prev.y - next.y) > REDACTION_CHANGE_EPSILON ||
      Math.abs(prev.width - next.width) > REDACTION_CHANGE_EPSILON ||
      Math.abs(prev.height - next.height) > REDACTION_CHANGE_EPSILON
    )
  }

  // --- Actions ---

  function startDraw(e: PointerEvent) {
    if (!isRedactMode.value) return
    if (e.button !== 0) return
    e.preventDefault()

    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      selectedIds.value.clear()
    }

    syncOverlayMetrics?.()
    if (overlayRef.value) {
      cachedBounds.value = overlayRef.value.getBoundingClientRect()
      overlayRef.value.setPointerCapture(e.pointerId)
    }

    interactionMode.value = 'draw'
    isDrawing.value = true

    const point = getPoint(e)
    drawStart.value = point
    drawCurrent.value = point
  }

  function startMove(e: PointerEvent, id: string, redaction: RedactionMark) {
    if (!isRedactMode.value) return
    if (e.button !== 0) return

    e.preventDefault()
    e.stopPropagation()

    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey

    if (isMulti) {
      if (selectedIds.value.has(id)) selectedIds.value.delete(id)
      else selectedIds.value.add(id)
      return
    } else {
      if (!selectedIds.value.has(id) || selectedIds.value.size > 1) {
        selectedIds.value.clear()
        selectedIds.value.add(id)
      }
    }

    syncOverlayMetrics?.()
    if (overlayRef.value) {
      cachedBounds.value = overlayRef.value.getBoundingClientRect()
      overlayRef.value.setPointerCapture(e.pointerId)
    }

    draggingId.value = id
    interactionMode.value = 'move'
    dragStartPoint.value = getPoint(e)
    dragStartRect.value = getRedactionRect(redaction)

    // Valid now because we updated DraftRect type
    draftRect.value = { id: id, ...dragStartRect.value }
  }

  function startResize(e: PointerEvent, handle: Handle, id: string, redaction: RedactionMark) {
    if (!isRedactMode.value) return
    e.stopPropagation()
    e.preventDefault()

    selectedIds.value.clear()
    selectedIds.value.add(id)

    syncOverlayMetrics?.()
    if (overlayRef.value) {
      cachedBounds.value = overlayRef.value.getBoundingClientRect()
      overlayRef.value.setPointerCapture(e.pointerId)
    }

    draggingId.value = id
    interactionMode.value = 'resize'
    activeHandle.value = handle
    dragStartPoint.value = getPoint(e)
    dragStartRect.value = getRedactionRect(redaction)

    // Valid now because we updated DraftRect type
    draftRect.value = { id: id, ...dragStartRect.value }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!interactionMode.value) return
    const point = getPoint(e)

    if (interactionMode.value === 'draw') {
      drawCurrent.value = point
      return
    }

    if (!dragStartPoint.value || !dragStartRect.value || !draggingId.value) return

    const dx = point.x - dragStartPoint.value.x
    const dy = point.y - dragStartPoint.value.y
    const bounds = cachedBounds.value || overlayMetrics.value

    if (interactionMode.value === 'move') {
      const w = dragStartRect.value.width
      const h = dragStartRect.value.height
      draftRect.value = {
        id: draggingId.value,
        left: clamp(dragStartRect.value.left + dx, 0, bounds.width - w),
        top: clamp(dragStartRect.value.top + dy, 0, bounds.height - h),
        width: w,
        height: h,
      }
    } else if (interactionMode.value === 'resize' && activeHandle.value) {
      let { left, top, width, height } = dragStartRect.value
      const min = REDACTION_MIN_SIZE_PX

      switch (activeHandle.value) {
        case 'se':
          width = clamp(dragStartRect.value.width + dx, min, bounds.width - left)
          height = clamp(dragStartRect.value.height + dy, min, bounds.height - top)
          break
        case 'sw':
          const maxLeft = dragStartRect.value.left + dragStartRect.value.width - min
          left = clamp(dragStartRect.value.left + dx, 0, maxLeft)
          width = dragStartRect.value.width + (dragStartRect.value.left - left)
          height = clamp(dragStartRect.value.height + dy, min, bounds.height - top)
          break
        case 'ne':
          const maxTop = dragStartRect.value.top + dragStartRect.value.height - min
          top = clamp(dragStartRect.value.top + dy, 0, maxTop)
          height = dragStartRect.value.height + (dragStartRect.value.top - top)
          width = clamp(dragStartRect.value.width + dx, min, bounds.width - left)
          break
        case 'nw':
          const maxL = dragStartRect.value.left + dragStartRect.value.width - min
          const maxT = dragStartRect.value.top + dragStartRect.value.height - min
          left = clamp(dragStartRect.value.left + dx, 0, maxL)
          top = clamp(dragStartRect.value.top + dy, 0, maxT)
          width = dragStartRect.value.width + (dragStartRect.value.left - left)
          height = dragStartRect.value.height + (dragStartRect.value.top - top)
          break
      }
      draftRect.value = { id: draggingId.value, left, top, width, height }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!interactionMode.value) return
    overlayRef.value?.releasePointerCapture(e.pointerId)

    if (interactionMode.value === 'draw' && drawingRect.value) {
      const r = drawingRect.value
      if (r.width > REDACTION_MIN_SIZE_PX && r.height > REDACTION_MIN_SIZE_PX) {
        const newRedaction = {
          id: crypto.randomUUID(),
          ...toPdfRect(r)!,
          color: redactionColor.value,
        } as RedactionMark
        actions.addRedaction(pageRef.value!.id, newRedaction)
        selectedIds.value.clear()
        selectedIds.value.add(newRedaction.id)
      }
    } else if (draftRect.value && draggingId.value && pageRef.value) {
      const prev = pageRedactions.value.find((r) => r.id === draggingId.value)
      const nextRect = toPdfRect(draftRect.value)
      if (prev && nextRect) {
        const next = { ...prev, ...nextRect }
        if (hasMeaningfulGeometryChange(prev, next)) {
          actions.updateRedaction(pageRef.value.id, prev, next)
        }
      }
    }

    cancelInteraction()
  }

  function cancelInteraction() {
    interactionMode.value = null
    isDrawing.value = false
    draggingId.value = null
    activeHandle.value = null
    dragStartPoint.value = null
    draftRect.value = null
    drawStart.value = null
    drawCurrent.value = null
    cachedBounds.value = null
  }

  // 2. Clear Selection (Exposed)
  function clearSelection() {
    selectedIds.value.clear()
  }

  // 3. Reset Redaction State (Exposed - Full Reset)
  function resetRedactionState() {
    cancelInteraction()
    clearSelection()
  }

  function deleteSelectedRedactions() {
    if (!pageRef.value || selectedIds.value.size === 0) return
    const pageId = pageRef.value.id
    const toDelete = pageRedactions.value.filter((r) => selectedIds.value.has(r.id))
    if (toDelete.length) {
      actions.deleteRedactions(pageId, toDelete)
      selectedIds.value.clear()
    }
  }

  function toggleRedactMode() {
    isRedactMode.value = !isRedactMode.value
    cancelInteraction()
    if (!isRedactMode.value) selectedIds.value.clear()
  }

  function isSelected(id: string) {
    return selectedIds.value.has(id)
  }

  return {
    isRedactMode,
    drawingRect,
    selectedIds,
    hasSelectedRedaction,
    overlayCursor,

    startDraw,
    startMove,
    startResize,
    handlePointerMove,
    handlePointerUp,

    getRedactionRect,
    deleteSelectedRedactions,
    toggleRedactMode,
    isSelected,

    clearSelection,
    resetRedactionState,
  }
}
