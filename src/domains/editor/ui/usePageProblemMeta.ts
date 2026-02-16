import { computed, toRef, type MaybeRefOrGetter } from 'vue'
import type { LintResult, Severity } from '@/shared/types/linter'

export type PageProblemMeta = {
  severity?: Severity
  messages: string[]
}

const EMPTY_PAGE_PROBLEM_META: PageProblemMeta = {
  severity: undefined,
  messages: [],
}

export function usePageProblemMeta(
  problemsByPageId: MaybeRefOrGetter<Map<string, LintResult[]>>,
) {
  const problemsByPageIdRef = toRef(problemsByPageId)

  const pageProblemsById = computed(() => {
    const pageMeta = new Map<string, PageProblemMeta>()

    for (const [pageId, problems] of problemsByPageIdRef.value) {
      let severity: PageProblemMeta['severity']
      if (problems.some((problem) => problem.severity === 'error')) {
        severity = 'error'
      } else if (problems.some((problem) => problem.severity === 'warning')) {
        severity = 'warning'
      } else if (problems.some((problem) => problem.severity === 'info')) {
        severity = 'info'
      } else {
        severity = undefined
      }

      pageMeta.set(pageId, {
        severity,
        messages: problems.map((problem) => problem.message),
      })
    }

    return pageMeta
  })

  function getPageProblemMeta(pageId: string): PageProblemMeta {
    return pageProblemsById.value.get(pageId) ?? EMPTY_PAGE_PROBLEM_META
  }

  return {
    pageProblemsById,
    getPageProblemMeta,
  }
}
