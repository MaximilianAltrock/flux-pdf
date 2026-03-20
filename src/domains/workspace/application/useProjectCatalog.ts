import { useSettingsPreferencesState } from '@/domains/settings/application'
import { createProjectAuthoringService } from '@/domains/project-session/application/project-authoring.service'
import {
  createProjectCatalogService,
  resolveProjectCatalogDefaults,
} from '@/domains/project-session/application/project-catalog.service'
import { createProjectPersistenceService } from '@/domains/project-session/application/project-persistence.service'

export function useProjectCatalog() {
  const { preferences } = useSettingsPreferencesState()
  const persistence = createProjectPersistenceService()
  const authoring = createProjectAuthoringService(persistence)

  return createProjectCatalogService({
    persistence,
    authoring,
    getDefaults: () => resolveProjectCatalogDefaults(preferences.value),
  })
}
