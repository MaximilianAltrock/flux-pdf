import { computed, toRef, type MaybeRefOrGetter } from 'vue'
import { isDividerEntry, type PageEntry } from '@/shared/types'

type UseMobileGridTargetsOptions = {
  localPages: MaybeRefOrGetter<ReadonlyArray<PageEntry>>
  selectedIds: MaybeRefOrGetter<ReadonlySet<string>>
  isSplit: MaybeRefOrGetter<boolean>
  isMove: MaybeRefOrGetter<boolean>
}

export function useMobileGridTargets(options: UseMobileGridTargetsOptions) {
  const localPagesRef = toRef(options.localPages)
  const selectedIdsRef = toRef(options.selectedIds)
  const isSplitRef = toRef(options.isSplit)
  const isMoveRef = toRef(options.isMove)

  const splitTargets = computed(() => {
    if (!isSplitRef.value) return new Set<number>()

    const pages = localPagesRef.value
    const targets = new Set<number>()

    for (let index = 1; index < pages.length; index += 1) {
      const previous = pages[index - 1]
      const next = pages[index]

      if (!previous || !next) continue
      if (isDividerEntry(previous) || isDividerEntry(next)) continue

      targets.add(index)
    }

    return targets
  })

  const dropTargets = computed(() => {
    if (!isMoveRef.value) return new Set<number>()

    const pages = localPagesRef.value
    const targets = new Set<number>()

    for (let index = 0; index <= pages.length; index += 1) {
      const previousPage = index > 0 ? pages[index - 1] : undefined
      const nextPage = index < pages.length ? pages[index] : undefined

      const previousSelected =
        previousPage &&
        !isDividerEntry(previousPage) &&
        selectedIdsRef.value.has(previousPage.id)
      const nextSelected =
        nextPage && !isDividerEntry(nextPage) && selectedIdsRef.value.has(nextPage.id)

      if (!previousSelected && !nextSelected) {
        targets.add(index)
      }
      if (previousSelected && !nextSelected) {
        targets.add(index)
      }
      if (!previousSelected && nextSelected) {
        targets.add(index)
      }
    }

    return targets
  })

  return {
    splitTargets,
    dropTargets,
  }
}
