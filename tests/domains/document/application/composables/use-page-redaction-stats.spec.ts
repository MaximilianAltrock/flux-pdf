import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePageRedactionStats } from '@/domains/document/application/composables/usePageRedactionStats'
import type { PageReference } from '@/shared/types'

function makePage(
  id: string,
  redactionCount: number,
  sourceFileId = 'source-1',
  sourcePageIndex = 0,
): PageReference {
  return {
    id,
    sourceFileId,
    sourcePageIndex,
    rotation: 0,
    redactions: Array.from({ length: redactionCount }, (_, index) => ({
      id: `${id}-r-${index}`,
      x: index,
      y: index,
      width: 10,
      height: 10,
    })),
  }
}

describe('usePageRedactionStats', () => {
  it('computes stats for plain values', () => {
    const pages: PageReference[] = [makePage('p1', 1), makePage('p2', 2)]

    const stats = usePageRedactionStats(pages)

    expect(stats.redactionCount.value).toBe(3)
    expect(stats.hasRedactions.value).toBe(true)
  })

  it('reacts to ref updates', () => {
    const pages = ref<PageReference[]>([makePage('p1', 0)])
    const stats = usePageRedactionStats(pages)

    expect(stats.redactionCount.value).toBe(0)
    expect(stats.hasRedactions.value).toBe(false)

    pages.value = [makePage('p1', 2), makePage('p2', 1)]

    expect(stats.redactionCount.value).toBe(3)
    expect(stats.hasRedactions.value).toBe(true)
  })

  it('reacts to getter inputs', () => {
    const pages = ref<PageReference[]>([makePage('p1', 1)])
    const stats = usePageRedactionStats(() => pages.value)

    expect(stats.redactionCount.value).toBe(1)

    pages.value = [makePage('p1', 1), makePage('p2', 1), makePage('p3', 1)]

    expect(stats.redactionCount.value).toBe(3)
    expect(stats.hasRedactions.value).toBe(true)
  })
})
