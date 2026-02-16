import { describe, expect, it, vi } from 'vitest'
import { createProjectRouteSync } from '@/domains/workspace/application/project-route-sync'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('createProjectRouteSync', () => {
  it('loads valid project ids without redirecting', async () => {
    const switchProject = vi.fn().mockResolvedValue(true)
    const redirectToDashboard = vi.fn()
    const routeSync = createProjectRouteSync({
      switchProject,
      redirectToDashboard,
    })

    await routeSync.syncProjectFromRouteParam('project-1')

    expect(switchProject).toHaveBeenCalledWith('project-1')
    expect(redirectToDashboard).not.toHaveBeenCalled()
  })

  it('redirects for invalid route params', async () => {
    const switchProject = vi.fn().mockResolvedValue(true)
    const redirectToDashboard = vi.fn()
    const routeSync = createProjectRouteSync({
      switchProject,
      redirectToDashboard,
    })

    await routeSync.syncProjectFromRouteParam('   ')

    expect(switchProject).not.toHaveBeenCalled()
    expect(redirectToDashboard).toHaveBeenCalledTimes(1)
  })

  it('ignores stale failed loads when a newer route sync succeeds', async () => {
    const firstRequest = createDeferred<boolean>()
    const secondRequest = createDeferred<boolean>()
    const switchProject = vi.fn((projectId: string) => {
      if (projectId === 'first') return firstRequest.promise
      if (projectId === 'second') return secondRequest.promise
      return Promise.resolve(false)
    })
    const redirectToDashboard = vi.fn()
    const routeSync = createProjectRouteSync({
      switchProject,
      redirectToDashboard,
    })

    const firstJob = routeSync.syncProjectFromRouteParam('first')
    const secondJob = routeSync.syncProjectFromRouteParam('second')

    secondRequest.resolve(true)
    await secondJob

    firstRequest.resolve(false)
    await firstJob

    expect(switchProject).toHaveBeenNthCalledWith(1, 'first')
    expect(switchProject).toHaveBeenNthCalledWith(2, 'second')
    expect(redirectToDashboard).not.toHaveBeenCalled()
  })

  it('redirects when the latest project load fails', async () => {
    const switchProject = vi.fn().mockResolvedValue(false)
    const redirectToDashboard = vi.fn()
    const routeSync = createProjectRouteSync({
      switchProject,
      redirectToDashboard,
    })

    await routeSync.syncProjectFromRouteParam('project-2')

    expect(redirectToDashboard).toHaveBeenCalledTimes(1)
  })
})
