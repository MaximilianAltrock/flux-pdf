import { toast } from 'vue-sonner'

export type ToastType = 'success' | 'destructive' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

/**
 * Composable for managing toast notifications
 * Updated to use vue-sonner while keeping the existing API
 */
export function useToast() {
  /**
   * Type A: "Efficiency Flex" - Export success with timing
   */
  function success(title: string, detail?: string, action?: ToastAction): string | number {
    return toast.success(title, {
      description: detail,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    })
  }

  /**
   * Type B: "Safety Net" - Destructive action with UNDO
   */
  function destructive(title: string, detail?: string, onUndo?: () => void): string | number {
    return toast.error(title, {
      description: detail,
      action: onUndo
        ? {
            label: 'UNDO',
            onClick: onUndo,
          }
        : undefined,
      duration: 6000,
    })
  }

  /**
   * Type C: "System Alert" - Error/Warning
   */
  function warning(title: string, detail?: string): string | number {
    return toast.warning(title, {
      description: detail,
      duration: Infinity,
    })
  }

  /**
   * Alias for warning - system errors
   */
  function error(title: string, detail?: string): string | number {
    return toast.error(title, {
      description: detail,
    })
  }

  /**
   * Type D: "Session Restore" - Contextual info
   */
  function info(title: string, detail?: string): string | number {
    return toast.info(title, {
      description: detail,
    })
  }

  function dismiss(id: string | number): void {
    toast.dismiss(id)
  }

  function dismissAll(): void {
    toast.dismiss()
  }

  return {
    success,
    destructive,
    warning,
    error,
    info,
    dismiss,
    dismissAll,
  }
}
