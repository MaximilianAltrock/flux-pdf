import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { useHistoryStore } from '@/domains/history/store/history.store'
import { useUiStore } from '@/domains/editor/store/ui.store'
import { useExportStore } from '@/domains/export/store/export.store'
import { useProjectsStore } from '@/domains/workspace/store/projects.store'
import { useSettingsStore } from '@/domains/workspace/store/settings.store'
import { useDocumentServiceBindings } from '@/app/document-service.bindings'

export function useEditorCompositionRoot() {
  const documentStore = useDocumentStore()
  const historyStore = useHistoryStore()
  const uiStore = useUiStore()
  const exportStore = useExportStore()
  const projectsStore = useProjectsStore()
  const settingsStore = useSettingsStore()

  const { zoom, importJob, ignoredPreflightRuleIds } = storeToRefs(uiStore)
  const { exportJob } = storeToRefs(exportStore)
  const { preferences } = storeToRefs(settingsStore)
  const { activeProjectId, activeProjectMeta } = storeToRefs(projectsStore)

  const autoGenerateOutlineSinglePage = computed(
    () => preferences.value.autoGenerateOutlineSinglePage,
  )
  const filenamePattern = computed(() => preferences.value.filenamePattern)

  const documentService = useDocumentServiceBindings({
    documentStore,
    historyStore,
    ui: {
      setLoading: uiStore.setLoading,
      importJob,
      exportJob,
    },
    settings: {
      autoGenerateOutlineSinglePage,
      filenamePattern,
    },
  })

  return {
    stores: {
      documentStore,
      historyStore,
      uiStore,
      exportStore,
      projectsStore,
      settingsStore,
    },
    refs: {
      zoom,
      importJob,
      exportJob,
      ignoredPreflightRuleIds,
      preferences,
      activeProjectId,
      activeProjectMeta,
    },
    services: {
      documentService,
    },
  }
}
