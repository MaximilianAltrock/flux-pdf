import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePageProblemMeta } from '@/domains/editor/ui/usePageProblemMeta'
import type { LintResult } from '@/shared/types/linter'

function problem(severity: LintResult['severity'], message: string): LintResult {
  return {
    ruleId: `${severity}-${message}`,
    severity,
    message,
    pageIds: ['p1'],
  }
}

describe('usePageProblemMeta', () => {
  it('aggregates page severity by highest priority', () => {
    const map = ref(
      new Map<string, LintResult[]>([
        ['p1', [problem('info', 'Informational'), problem('warning', 'Warning')]],
        ['p2', [problem('error', 'Error')]],
      ]),
    )
    const { getPageProblemMeta } = usePageProblemMeta(map)

    expect(getPageProblemMeta('p1')).toEqual({
      severity: 'warning',
      messages: ['Informational', 'Warning'],
    })
    expect(getPageProblemMeta('p2')).toEqual({
      severity: 'error',
      messages: ['Error'],
    })
  })

  it('returns empty metadata for unknown pages', () => {
    const { getPageProblemMeta } = usePageProblemMeta(() => new Map())

    expect(getPageProblemMeta('missing')).toEqual({
      severity: undefined,
      messages: [],
    })
  })
})

