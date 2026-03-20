<script setup lang="ts">
/**
 * EditorView - Project workspace shell
 *
 * Owns document state + editor layouts and loads project data on route changes.
 */

import { computed, onBeforeUnmount, watch, watchEffect, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

// Composables
import { useKeyboardShortcuts } from '@/domains/editor/application/useKeyboardShortcuts'
import { provideDocumentActions, useDocumentActions } from '@/domains/editor/application/useDocumentActions'
import { providePreflight, usePreflight } from '@/domains/editor/application/usePreflight'
import { createProjectSession, provideProjectSession } from '@/domains/project-session/session'
import { useFileInput } from '@/shared/composables/useFileInput'
import { useMobile } from '@/shared/composables/useMobile'
import { createProjectRouteSync } from '@/domains/project-session/application/project-route-sync'
import { createLogger } from '@/shared/infrastructure/logger'

// Layouts
import DesktopLayout from '@/domains/editor/ui/layouts/DesktopLayout.vue'
import MobileLayout from '@/domains/editor/ui/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/domains/export/ui/components/ExportModal.vue'
import MobileExportSheet from '@/domains/export/ui/components/mobile/MobileExportSheet.vue'
import DiffModal from '@/domains/editor/ui/components/DiffModal.vue'
import PagePreviewModal from '@/domains/editor/ui/components/PagePreviewModal.vue'

// ============================================
// Initialization
// ============================================

// Initialize stores and actions
const session = provideProjectSession(createProjectSession())
const actions = useDocumentActions(session)
provideDocumentActions(actions)
providePreflight(usePreflight(session))
const { isMobile } = useMobile()
const hasOpenModal = computed(
  () => session.editor.hasOpenModal || session.exportOperation.showExportModal,
)
const { setFileInputRef } = useFileInput()
const route = useRoute()
const router = useRouter()
const log = createLogger('editor-view')
const routeSync = createProjectRouteSync({
  switchProject: (projectId) => session.project.switchProject(projectId),
  redirectToDashboard: () => router.replace('/'),
})

// Initialize keyboard shortcuts (desktop only)
useKeyboardShortcuts(actions, { isModalOpen: hasOpenModal }, session)

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

watchEffect(() => {
  setFileInputRef(fileInput.value ?? null)
})

watch(
  () => route.params.id,
  (id) => {
    void routeSync.syncProjectFromRouteParam(id)
  },
  { immediate: true },
)

onBeforeRouteLeave(async () => {
  actions.commitProjectTitle()
  try {
    await session.project.persistActiveProject()
  } catch (error) {
    log.error('Failed to persist project before leaving:', error)
  }
})

onBeforeUnmount(() => {
  setFileInputRef(null)
})
</script>
<template>
  <div
    class="h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden supports-[height:100dvh]:h-dvh"
  >
    <!-- Hidden File Input (shared across layouts) -->
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf,.pdf,image/jpeg,image/png"
      multiple
      class="hidden"
      @change="actions.handleFileInputChange"
    />

    <!-- Mobile Layout -->
    <MobileLayout v-if="isMobile" />

    <!-- Desktop Layout -->
    <DesktopLayout v-else />

    <!-- ============================================
         Shared Overlays (render above both layouts)
         ============================================ -->

    <!-- Export Modal / Sheet -->
    <MobileExportSheet
      v-if="isMobile"
      :open="session.exportOperation.showExportModal"
      :export-selected="session.exportOperation.exportSelectedOnly"
      @close="session.exportOperation.closeExportModal"
      @success="actions.handleExportSuccess"
    />
    <ExportModal
      v-else
      :open="session.exportOperation.showExportModal"
      :export-selected="session.exportOperation.exportSelectedOnly"
      @close="session.exportOperation.closeExportModal"
      @success="actions.handleExportSuccess"
    />

    <!-- Page Preview Modal -->
    <PagePreviewModal
      :open="session.editor.showPreviewModal"
      @update:open="(val: boolean) => !val && actions.handleClosePreview()"
      :page-ref="session.editor.previewPageRef"
      @navigate="session.editor.navigatePreview"
    />

    <!-- Ghost Overlay -->
    <DiffModal
      :open="session.editor.showDiffModal"
      @update:open="(val: boolean) => !val && session.editor.closeDiffModal()"
      :pages="session.editor.diffPages"
      @close="session.editor.closeDiffModal"
    />
  </div>
</template>

<style scoped>
</style>
