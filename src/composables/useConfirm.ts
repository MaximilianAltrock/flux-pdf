import { ref, shallowRef } from 'vue'

export type ConfirmVariant = 'danger' | 'warning' | 'info'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const isOpen = shallowRef(false)
const state = ref<ConfirmState | null>(null)

/**
 * Composable for showing confirmation dialogs
 */
export function useConfirm() {
  /**
   * Show a confirmation dialog and wait for user response
   */
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        ...options,
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        variant: options.variant ?? 'info',
        resolve,
      }
      isOpen.value = true
    })
  }

  /**
   * Handle user confirming
   */
  function handleConfirm(): void {
    const resolver = state.value?.resolve
    close()
    if (resolver) resolver(true)
  }

  /**
   * Handle user canceling
   */
  function handleCancel(): void {
    const resolver = state.value?.resolve
    close()
    if (resolver) resolver(false)
  }

  /**
   * Close the dialog
   */
  function close(): void {
    isOpen.value = false
    state.value = null
  }

  // Convenience methods for common confirmations
  async function confirmDelete(itemCount: number, itemName = 'item'): Promise<boolean> {
    const plural = itemCount > 1
    return confirm({
      title: `Delete ${itemCount} ${itemName}${plural ? 's' : ''}?`,
      message: `This action cannot be undone. ${plural ? 'These' : 'This'} ${itemName}${plural ? 's' : ''} will be permanently removed.`,
      confirmText: 'Delete',
      variant: 'danger',
    })
  }

  async function confirmDiscard(): Promise<boolean> {
    return confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes that will be lost.',
      confirmText: 'Discard',
      variant: 'warning',
    })
  }

  async function confirmClearWorkspace(): Promise<boolean> {
    return confirm({
      title: 'Clear Workspace?',
      message: 'This will remove all files and history. This action cannot be undone.',
      confirmText: 'Clear & Start New',
      variant: 'danger',
    })
  }

  return {
    isOpen,
    state,
    confirm,
    handleConfirm,
    handleCancel,
    close,
    confirmDelete,
    confirmDiscard,
    confirmClearWorkspace,
  }
}
