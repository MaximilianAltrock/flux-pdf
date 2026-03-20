import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  useLiveProjectList,
  type LiveProjectListSubscriber,
} from '@/domains/workspace/application/useLiveProjectList'

describe('useLiveProjectList', () => {
  it('uses the live subscription as the only normal-path data read', async () => {
    const unsubscribe = vi.fn()
    const load = vi.fn(async () => ['project-1', 'project-2'])
    const subscriber: LiveProjectListSubscriber<string> = {
      subscribe(query, observer) {
        void query().then(observer.next)
        return { unsubscribe }
      },
    }

    const scope = effectScope()
    const state = scope.run(() => useLiveProjectList(load, { subscriber }))

    await Promise.resolve()

    expect(load).toHaveBeenCalledTimes(1)
    expect(state?.items.value).toEqual(['project-1', 'project-2'])
    expect(state?.isLoading.value).toBe(false)

    scope.stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('falls back to one manual reload only after a subscription error', async () => {
    const unsubscribe = vi.fn()
    const errors: unknown[] = []
    const load = vi.fn(async () => ['recovered-project'])
    const subscriber: LiveProjectListSubscriber<string> = {
      subscribe(_query, observer) {
        observer.error(new Error('subscription failed'))
        return { unsubscribe }
      },
    }

    const scope = effectScope()
    const state = scope.run(() =>
      useLiveProjectList(load, {
        subscriber,
        onError(error) {
          errors.push(error)
        },
      }),
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(load).toHaveBeenCalledTimes(1)
    expect(state?.items.value).toEqual(['recovered-project'])
    expect(state?.isLoading.value).toBe(false)

    scope.stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
