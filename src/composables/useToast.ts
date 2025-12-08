import { ref, computed } from 'vue'

export type ToastType = 'success' | 'destructive' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: ToastType
  title: string
  detail?: string
  duration: number // 0 = infinite (manual dismiss required)
  action?: ToastAction
  createdAt: number
}

interface ToastOptions {
  title: string
  detail?: string
  type?: ToastType
  duration?: number
  action?: ToastAction
}

const toasts = ref<Toast[]>([])
const MAX_VISIBLE = 3

// Default durations per type (from spec)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  destructive: 6000, // Extra time for panic-undo
  warning: 0, // Infinite - must be manually dismissed
  info: 3000,
}

/**
 * Composable for managing toast notifications
 * Designed to match the FluxPDF IDE-style notification system
 */
export function useToast() {
  // Only show max 3, newest on top
  const activeToasts = computed(() => toasts.value.slice(0, MAX_VISIBLE))

  function addToast(options: ToastOptions): string {
    const id = crypto.randomUUID()
    const type = options.type ?? 'info'

    const toast: Toast = {
      id,
      type,
      title: options.title,
      detail: options.detail,
      duration: options.duration ?? DEFAULT_DURATIONS[type],
      action: options.action,
      createdAt: Date.now(),
    }

    // Add to beginning (newest on top)
    toasts.value.unshift(toast)

    // Auto-dismiss after duration (if not infinite)
    if (toast.duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, toast.duration)
    }

    return id
  }

  function dismiss(id: string): void {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function dismissAll(): void {
    toasts.value = []
  }

  // === Convenience methods matching the spec ===

  /**
   * Type A: "Efficiency Flex" - Export success with timing
   */
  function success(title: string, detail?: string, action?: ToastAction): string {
    return addToast({
      title,
      detail,
      type: 'success',
      action,
    })
  }

  /**
   * Type B: "Safety Net" - Destructive action with UNDO
   */
  function destructive(title: string, detail?: string, onUndo?: () => void): string {
    const id = crypto.randomUUID()

    const toast: Toast = {
      id,
      type: 'destructive',
      title,
      detail,
      duration: DEFAULT_DURATIONS.destructive,
      createdAt: Date.now(),
      action: onUndo
        ? {
            label: 'UNDO',
            onClick: () => {
              onUndo()
              dismiss(id) // Instantly remove toast on undo
            },
          }
        : undefined,
    }

    toasts.value.unshift(toast)

    setTimeout(() => {
      dismiss(id)
    }, toast.duration)

    return id
  }

  /**
   * Type C: "System Alert" - Error/Warning (infinite, must dismiss)
   */
  function warning(title: string, detail?: string): string {
    return addToast({
      title,
      detail,
      type: 'warning',
      duration: 0, // Infinite - must be manually dismissed
    })
  }

  /**
   * Alias for warning - system errors
   */
  function error(title: string, detail?: string): string {
    return warning(title, detail)
  }

  /**
   * Type D: "Session Restore" - Contextual info
   */
  function info(title: string, detail?: string): string {
    return addToast({
      title,
      detail,
      type: 'info',
    })
  }

  return {
    toasts: activeToasts,
    addToast,
    dismiss,
    dismissAll,
    success,
    destructive,
    warning,
    error,
    info,
  }
}
