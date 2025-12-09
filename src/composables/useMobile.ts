import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'

const MOBILE_BREAKPOINT = 768

// Shared reactive state (singleton pattern)
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const screenHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

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

  const isMobile = computed(() => screenWidth.value < MOBILE_BREAKPOINT)

  /**
   * Trigger haptic feedback via Vibration API
   */
  function haptic(pattern: 'light' | 'medium' | 'heavy' | 'success' = 'light') {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30],
      success: [20, 50, 20], // Double buzz for export complete
    }

    try {
      navigator.vibrate(patterns[pattern])
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
    setTimeout(() => URL.revokeObjectURL(url), 1000)

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
        window.history.pushState({ modal: true }, '')
        window.addEventListener('popstate', onPop)
        isListening = true
      } else {
        // Modal Closed: Cleanup
        if (isListening) {
          // If still listening, it means closed via UI (X button), not Back.
          // We must manually revert the history state we pushed.
          window.removeEventListener('popstate', onPop)
          window.history.back()
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
