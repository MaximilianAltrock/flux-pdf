import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { DividerReference, PageReference } from '@/shared/types'
import { useMobileGridTargets } from '@/domains/editor/ui/useMobileGridTargets'

function createPage(id: string, sourcePageIndex: number): PageReference {
  return {
    id,
    sourceFileId: 'source-1',
    sourcePageIndex,
    rotation: 0,
  }
}

function createDivider(id: string): DividerReference {
  return {
    id,
    isDivider: true,
  }
}

describe('useMobileGridTargets', () => {
  it('adds split targets only between adjacent non-divider pages', () => {
    const localPages = ref([
      createPage('p1', 0),
      createPage('p2', 1),
      createDivider('d1'),
      createPage('p3', 2),
      createPage('p4', 3),
    ])
    const selectedIds = ref(new Set<string>())
    const isSplit = ref(true)
    const isMove = ref(false)

    const { splitTargets } = useMobileGridTargets({
      localPages,
      selectedIds,
      isSplit,
      isMove,
    })

    expect(Array.from(splitTargets.value)).toEqual([1, 4])
  })

  it('excludes drop targets that are fully inside a selected block', () => {
    const localPages = ref([
      createPage('p1', 0),
      createPage('p2', 1),
      createPage('p3', 2),
      createPage('p4', 3),
    ])
    const selectedIds = ref(new Set<string>(['p2', 'p3']))
    const isSplit = ref(false)
    const isMove = ref(true)

    const { dropTargets } = useMobileGridTargets({
      localPages,
      selectedIds,
      isSplit,
      isMove,
    })

    expect(Array.from(dropTargets.value)).toEqual([0, 1, 3, 4])
  })

  it('returns empty target sets when mobile split and move modes are inactive', () => {
    const localPages = ref([createPage('p1', 0), createPage('p2', 1)])
    const selectedIds = ref(new Set<string>())
    const isSplit = ref(false)
    const isMove = ref(false)

    const { splitTargets, dropTargets } = useMobileGridTargets({
      localPages,
      selectedIds,
      isSplit,
      isMove,
    })

    expect(splitTargets.value.size).toBe(0)
    expect(dropTargets.value.size).toBe(0)
  })
})

