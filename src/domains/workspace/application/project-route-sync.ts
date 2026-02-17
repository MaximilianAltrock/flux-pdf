import { normalizeProjectIdParam } from '@/domains/workspace/application/router-guards'
import { createLogger } from '@/shared/infrastructure/logger'

const log = createLogger('project-route-sync')

type ProjectRouteSyncOptions = {
  switchProject: (projectId: string) => Promise<boolean>
  redirectToDashboard: () => unknown | Promise<unknown>
}

export function createProjectRouteSync(options: ProjectRouteSyncOptions) {
  let latestRequestId = 0

  async function syncProjectFromRouteParam(param: unknown): Promise<void> {
    const projectId = normalizeProjectIdParam(param)
    if (!projectId) {
      await options.redirectToDashboard()
      return
    }

    const requestId = ++latestRequestId
    let loaded = false

    try {
      loaded = await options.switchProject(projectId)
    } catch (error) {
      log.error(`Failed to switch project "${projectId}" from route param:`, error)
      loaded = false
    }

    if (requestId !== latestRequestId) return
    if (!loaded) {
      await options.redirectToDashboard()
    }
  }

  return {
    syncProjectFromRouteParam,
  }
}
