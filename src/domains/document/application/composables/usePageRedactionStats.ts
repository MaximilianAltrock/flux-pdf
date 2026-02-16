import { computed, toRef, type MaybeRefOrGetter } from 'vue'
import type { PageReference } from '@/shared/types'

export function usePageRedactionStats(
  pages: MaybeRefOrGetter<ReadonlyArray<PageReference>>,
) {
  const pagesRef = toRef(pages)

  const redactionCount = computed(() =>
    pagesRef.value.reduce((sum, page) => sum + (page.redactions?.length ?? 0), 0),
  )

  const hasRedactions = computed(() => redactionCount.value > 0)

  return {
    redactionCount,
    hasRedactions,
  }
}
