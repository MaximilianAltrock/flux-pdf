import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPreflightState,
  providePreflight,
  usePreflightContext,
  type PreflightState,
} from '@/domains/editor/application/usePreflight'
import { createDocumentState } from '@/domains/project-session/session/document-state'
import { createEditorUiState } from '@/domains/project-session/session/editor-ui.state'
import { PreflightRuleId } from '@/shared/types/linter'
import type { LintResult } from '@/shared/types/linter'
import { mountVueComponent } from '../../../utils/mount-vue-component'

function createStubPreflightState() {
  const problems = ref<LintResult[]>([])
  const ignoredRules = ref<Set<string>>(new Set())

  const state: PreflightState = {
    problems: computed(() => problems.value),
    problemsByPageId: computed(() => new Map<string, LintResult[]>()),
    problemCount: computed(() => problems.value.length),
    isHealthy: computed(() => problems.value.length === 0),
    ignoreRule(ruleId: string) {
      ignoredRules.value = new Set([...ignoredRules.value, ruleId])
    },
    resetIgnoredRules() {
      ignoredRules.value = new Set()
    },
    ignoredRules: computed(() => ignoredRules.value),
  }

  return { state, problems }
}

describe('usePreflightContext', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when used without an editor preflight provider', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const Consumer = defineComponent({
      setup() {
        usePreflightContext()
        return () => h('div')
      },
    })

    expect(() => mountVueComponent(Consumer)).toThrow(
      'usePreflightContext must be used within EditorView provider',
    )
  })

  it('shares one reactive preflight instance through provider context', async () => {
    const { state, problems } = createStubPreflightState()

    const Consumer = defineComponent({
      setup() {
        const preflight = usePreflightContext()
        return () =>
          h(
            'div',
            `${preflight.problemCount.value}|${preflight.ignoredRules.value.size}|${preflight.isHealthy.value}`,
          )
      },
    })

    const Provider = defineComponent({
      setup() {
        providePreflight(state)
        return () => h(Consumer)
      },
    })

    const mounted = mountVueComponent(Provider)

    expect(mounted.host.textContent).toBe('0|0|true')

    problems.value = [
      {
        ruleId: PreflightRuleId.SIZE,
        severity: 'warning',
        message: 'Size mismatch',
        pageIds: ['page-1'],
      },
    ]
    state.ignoreRule('size')
    await nextTick()

    expect(mounted.host.textContent).toBe('1|1|false')

    mounted.unmount()
  })

  it('enriches missing source metrics lazily when preflight needs them', async () => {
    const store = createDocumentState()
    const editor = createEditorUiState()
    store.addSourceFile({
      id: 'source-1',
      filename: 'scan.pdf',
      pageCount: 1,
      fileSize: 1024,
      addedAt: Date.now(),
      color: 'zinc',
      pageMetaData: [{ width: 612, height: 792, rotation: 0 }],
    })
    store.addPages([
      {
        id: 'page-1',
        sourceFileId: 'source-1',
        sourcePageIndex: 0,
        rotation: 0,
        width: 612,
        height: 792,
      },
    ])

    const ensurePageAnalysisMetrics = vi.fn(async () => [
      {
        width: 612,
        height: 792,
        rotation: 0,
        textChars: 0,
        dominantImageCoverage: 1,
        dominantImageDpi: 100,
      },
    ])

    const preflight = createPreflightState(store, editor, {
      ensurePageAnalysisMetrics,
    })

    await Promise.resolve()
    await nextTick()

    expect(ensurePageAnalysisMetrics).toHaveBeenCalledTimes(1)
    expect(preflight.problems.value).toContainEqual(
      expect.objectContaining({
        ruleId: PreflightRuleId.LOW_QUALITY,
      }),
    )

    await nextTick()
    expect(ensurePageAnalysisMetrics).toHaveBeenCalledTimes(1)
  })
})
