import { nextTick, onScopeDispose, watch, type Ref } from 'vue'

type FocusTrapOptions = {
  /** Optional callback invoked on Escape. */
  onEscape?: () => void
  /**
   * Optional initial focus selector. If not provided, focuses the first focusable element,
   * otherwise focuses the container itself.
   */
  initialFocus?: () => HTMLElement | null
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',')

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    if (el.hasAttribute('disabled')) return false
    const style = window.getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') return false
    return true
  })
}

export function useFocusTrap(open: Ref<boolean>, containerRef: Ref<HTMLElement | null>, options: FocusTrapOptions = {}) {
  const { onEscape, initialFocus } = options

  let restoreFocusEl: HTMLElement | null = null
  let cleanup: (() => void) | null = null

  function activate() {
    const container = containerRef.value
    if (!container) return

    restoreFocusEl = (document.activeElement as HTMLElement | null) ?? null

    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }

    const onKeydown = (event: KeyboardEvent) => {
      if (!open.value) return
      if (!containerRef.value) return

      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        onEscape()
        return
      }

      if (event.key !== 'Tab') return

      const currentContainer = containerRef.value
      if (!currentContainer) return

      const focusables = getFocusableElements(currentContainer)
      if (focusables.length === 0) {
        event.preventDefault()
        currentContainer.focus()
        return
      }

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first || !currentContainer.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (!active || active === last || !currentContainer.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeydown, true)

    cleanup = () => {
      document.removeEventListener('keydown', onKeydown, true)
    }

    nextTick(() => {
      if (!open.value) return
      const currentContainer = containerRef.value
      if (!currentContainer) return

      const target = initialFocus?.() ?? getFocusableElements(currentContainer)[0] ?? currentContainer
      target.focus()
    })
  }

  function deactivate() {
    cleanup?.()
    cleanup = null

    const toRestore = restoreFocusEl
    restoreFocusEl = null

    nextTick(() => {
      toRestore?.focus?.()
    })
  }

  watch(
    open,
    (isOpen) => {
      if (isOpen) activate()
      else deactivate()
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    cleanup?.()
  })
}

