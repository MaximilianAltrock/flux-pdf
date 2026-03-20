import { computed, inject, provide, watch, type InjectionKey } from 'vue'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import { useProjectSession } from '@/domains/project-session/session'
import type { ProjectSession } from '@/domains/project-session/domain/project-session'
import { ensureSourcePageAnalysisMetrics } from '@/domains/import/infrastructure/import'
import { hasPageAnalysisMetrics, type PageMetrics } from '@/shared/types'
import type { LintResult } from '@/shared/types/linter'
import { createDocumentPreflightAnalysis } from '@/domains/document/application/preflight/analyze-document-preflight'

export interface CreatePreflightStateOptions {
  ensurePageAnalysisMetrics?: (sourceFileId: string) => Promise<PageMetrics[]>
}

export function createPreflightState(
  store: DocumentState,
  ui: EditorUiState,
  options: CreatePreflightStateOptions = {},
) {
  const ignoredRules = computed(() => new Set(ui.ignoredPreflightRuleIds))
  const rawProblems = createDocumentPreflightAnalysis(store)
  const ensurePageAnalysisMetrics =
    options.ensurePageAnalysisMetrics ?? ensureSourcePageAnalysisMetrics

  watch(
    () => [store.pagesVersion, store.sourcesVersion],
    () => {
      const sourceIdsNeedingMetrics = new Set<string>()

      for (const page of store.contentPages) {
        const source = store.sources.get(page.sourceFileId)
        const metrics = source?.pageMetaData?.[page.sourcePageIndex]
        if (hasPageAnalysisMetrics(metrics)) continue
        sourceIdsNeedingMetrics.add(page.sourceFileId)
      }

      for (const sourceFileId of sourceIdsNeedingMetrics) {
        void ensurePageAnalysisMetrics(sourceFileId)
          .then((pageMetaData) => {
            store.setSourcePageMetrics(sourceFileId, pageMetaData)
          })
          .catch((error) => {
            console.warn('Failed to enrich preflight page metrics:', error)
          })
      }
    },
    { immediate: true },
  )

  function ignoreRule(ruleId: string) {
    ui.ignorePreflightRule(ruleId)
  }

  function resetIgnoredRules() {
    ui.resetIgnoredPreflightRules()
  }

  const problems = computed<LintResult[]>(() => {
    return rawProblems.value.filter((problem) => !ignoredRules.value.has(problem.ruleId))
  })

  const problemsByPageId = computed(() => {
    const map = new Map<string, LintResult[]>()
    for (const problem of problems.value) {
      for (const pageId of problem.pageIds) {
        const list = map.get(pageId) ?? []
        list.push(problem)
        map.set(pageId, list)
      }
    }
    return map
  })

  const problemCount = computed(() => problems.value.length)
  const isHealthy = computed(() => problemCount.value === 0)

  return {
    problems,
    problemsByPageId,
    problemCount,
    isHealthy,
    ignoreRule,
    resetIgnoredRules,
    ignoredRules,
  }
}

export type PreflightState = ReturnType<typeof createPreflightState>

export function usePreflight(
  sessionOverride?: Pick<ProjectSession, 'document' | 'editor'>,
  options?: CreatePreflightStateOptions,
) {
  const { document, editor } = sessionOverride ?? useProjectSession()
  return createPreflightState(document, editor, options)
}

const preflightKey: InjectionKey<PreflightState> = Symbol('preflight')

export function providePreflight(preflight: PreflightState) {
  provide(preflightKey, preflight)
}

export function usePreflightContext(): PreflightState {
  const preflight = inject(preflightKey)
  if (!preflight) {
    throw new Error('usePreflightContext must be used within EditorView provider')
  }
  return preflight
}
