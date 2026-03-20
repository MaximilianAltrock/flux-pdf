import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  providePreflight,
  usePreflightContext,
  type PreflightState,
} from '@/domains/editor/application/usePreflight'
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
})
