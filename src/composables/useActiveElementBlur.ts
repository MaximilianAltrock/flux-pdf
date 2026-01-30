import { useActiveElement } from '@vueuse/core'

export function useActiveElementBlur() {
  const activeElement = useActiveElement<HTMLElement>()

  function blurActiveElement() {
    activeElement.value?.blur?.()
  }

  return { blurActiveElement }
}
