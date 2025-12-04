import { ref, computed } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
  dismissible: boolean
}

interface ToastOptions {
  title: string
  message?: string
  type?: ToastType
  duration?: number
  dismissible?: boolean
}

const toasts = ref<Toast[]>([])

const DEFAULT_DURATION = 4000

/**
 * Composable for managing toast notifications
 */
export function useToast() {
  const activeToasts = computed(() => toasts.value)

  function addToast(options: ToastOptions): string {
    const id = crypto.randomUUID()
    
    const toast: Toast = {
      id,
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? DEFAULT_DURATION,
      dismissible: options.dismissible ?? true
    }
    
    toasts.value.push(toast)
    
    // Auto-dismiss after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, toast.duration)
    }
    
    return id
  }

  function dismiss(id: string): void {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function dismissAll(): void {
    toasts.value = []
  }

  // Convenience methods
  function success(title: string, message?: string): string {
    return addToast({ title, message, type: 'success' })
  }

  function error(title: string, message?: string): string {
    return addToast({ title, message, type: 'error', duration: 6000 })
  }

  function warning(title: string, message?: string): string {
    return addToast({ title, message, type: 'warning' })
  }

  function info(title: string, message?: string): string {
    return addToast({ title, message, type: 'info' })
  }

  return {
    toasts: activeToasts,
    addToast,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info
  }
}
