import { ref, computed, watch, type Ref } from 'vue'
import { HAPTIC_PATTERNS, MOBILE, TIMEOUTS_MS } from '@/constants'

// Shared reactive state (singleton pattern)
const screenWidth = ref(
  typeof window !== 'undefined' ? window.innerWidth : MOBILE.FALLBACK_WIDTH_PX,
)
const screenHeight = ref(
  typeof window !== 'undefined' ? window.innerHeight : MOBILE.FALLBACK_HEIGHT_PX,
)

let listenerAttached = false

function updateDimensions() {
  if (typeof window === 'undefined') return
  screenWidth.value = window.innerWidth
  screenHeight.value = window.innerHeight
}

/**
 * Composable for mobile detection, haptics, and sharing
 */
export function useMobile() {
  // Attach resize listener once (singleton)
  if (typeof window !== 'undefined' && !listenerAttached) {
    listenerAttached = true
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
  }

  const isMobile = computed(() => screenWidth.value < MOBILE.BREAKPOINT_PX)

  /**
   * Trigger haptic feedback via Vibration API
   */
  function haptic(pattern: 'light' | 'medium' | 'heavy' | 'success' = 'light') {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

    try {
      navigator.vibrate(HAPTIC_PATTERNS[pattern])
    } catch {
      // Haptics not supported
    }
  }

  /**
   * Check if Web Share API is available
   */
  const canShare = computed(() => {
    if (typeof navigator === 'undefined') return false
    return 'share' in navigator
  })

  /**
   * Check if Web Share API supports files
   */
  const canShareFiles = computed(() => {
    if (typeof navigator === 'undefined') return false
    return 'share' in navigator && 'canShare' in navigator
  })

  /**
   * Share a file using native share sheet
   * Falls back to download if sharing not supported
   */
  async function shareFile(
    file: File,
    title?: string,
  ): Promise<{ shared: boolean; downloaded: boolean }> {
    // Try native share first
    if (canShareFiles.value) {
      try {
        const shareData: ShareData = {
          files: [file],
          title: title || file.name,
        }

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData)
          haptic('success')
          return { shared: true, downloaded: false }
        }
      } catch (err) {
        // User cancelled or share failed - fall through to download
        if ((err as Error).name === 'AbortError') {
          return { shared: false, downloaded: false }
        }
      }
    }

    // Fallback: trigger download
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), TIMEOUTS_MS.OBJECT_URL_REVOKE)

    haptic('success')
    return { shared: false, downloaded: true }
  }

  /**
   * Share just a URL/text (for simpler sharing)
   */
  async function shareUrl(url: string, title?: string, text?: string): Promise<boolean> {
    if (!canShare.value) return false

    try {
      await navigator.share({ url, title, text })
      return true
    } catch {
      return false
    }
  }

  /**
   * Android Back Button Handler (Reactive)
   * @param isOpen - The Ref indicating if the modal is visible
   * @param close - The function to call when Back is pressed
   */
  function onBackButton(isOpen: Ref<boolean>, close: () => void) {
    let isListening = false
    const modalStateId = crypto.randomUUID()

    const onPop = (e: PopStateEvent) => {
      // If we receive a popstate event, it means the user hit Back.
      // We consume the event and close the modal.
      if (isListening) {
        e.preventDefault()
        isListening = false // Mark as consumed so we don't double-back
        window.removeEventListener('popstate', onPop)
        close()
      }
    }

    watch(isOpen, (active) => {
      if (active) {
        // Modal Opened: Push state and listen
        window.history.pushState({ modal: true, modalStateId }, '')
        window.addEventListener('popstate', onPop)
        isListening = true
      } else {
        // Modal Closed: Cleanup
        if (isListening) {
          // If still listening, it means closed via UI (X button), not Back.
          // We must manually revert the history state we pushed.
          window.removeEventListener('popstate', onPop)
          if (window.history.state?.modalStateId === modalStateId) {
            window.history.back()
          }
          isListening = false
        }
      }
    })
  }

  return {
    isMobile,
    screenWidth,
    screenHeight,
    haptic,
    canShare,
    canShareFiles,
    shareFile,
    shareUrl,
    onBackButton,
  }
}
