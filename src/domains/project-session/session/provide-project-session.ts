import { inject, onScopeDispose, provide, type InjectionKey } from 'vue'
import type { ProjectSession } from '@/domains/project-session/domain/project-session'

export const projectSessionKey: InjectionKey<ProjectSession> = Symbol('project-session')

export function provideProjectSession(session: ProjectSession): ProjectSession {
  provide(projectSessionKey, session)
  onScopeDispose(() => {
    session.dispose()
  })
  return session
}

export function useProjectSession(): ProjectSession {
  const session = inject(projectSessionKey)
  if (!session) {
    throw new Error('useProjectSession must be used within a project session provider')
  }
  return session
}
