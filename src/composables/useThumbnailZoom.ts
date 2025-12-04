import { ref, computed } from 'vue'

// Zoom levels in pixels (thumbnail width)
const MIN_ZOOM = 120
const MAX_ZOOM = 320
const DEFAULT_ZOOM = 220
const STEP = 20

const STORAGE_KEY = 'fluxpdf-thumbnail-zoom'

const zoomLevel = ref(DEFAULT_ZOOM)

/**
 * Composable for managing thumbnail zoom level
 */
export function useThumbnailZoom() {
  // Initialize from localStorage
  function initZoom() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        zoomLevel.value = parsed
      }
    }
  }

  // Call init immediately
  initZoom()

  // Persist zoom level
  function setZoom(level: number) {
    zoomLevel.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
    localStorage.setItem(STORAGE_KEY, zoomLevel.value.toString())
  }

  function zoomIn() {
    setZoom(zoomLevel.value + STEP)
  }

  function zoomOut() {
    setZoom(zoomLevel.value - STEP)
  }

  function resetZoom() {
    setZoom(DEFAULT_ZOOM)
  }

  const canZoomIn = computed(() => zoomLevel.value < MAX_ZOOM)
  const canZoomOut = computed(() => zoomLevel.value > MIN_ZOOM)
  
  // Calculate grid column size based on zoom
  const gridColumnSize = computed(() => `${zoomLevel.value + 20}px`)
  
  // Percentage for slider display
  const zoomPercentage = computed(() => 
    Math.round(((zoomLevel.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100)
  )

  return {
    zoomLevel,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn,
    canZoomOut,
    gridColumnSize,
    zoomPercentage
  }
}
