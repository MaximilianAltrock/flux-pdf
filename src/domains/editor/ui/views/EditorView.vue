<script setup lang="ts">
/**
 * EditorView - Project workspace shell
 *
 * Owns document state + editor layouts and loads project data on route changes.
 */

import { computed, onBeforeUnmount, watch, watchEffect, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

// Composables
import { useKeyboardShortcuts } from '@/domains/editor/application/useKeyboardShortcuts'
import { provideDocumentActions, useDocumentActions } from '@/domains/editor/application/useDocumentActions'
import { useFileInput } from '@/shared/composables/useFileInput'
import { useMobile } from '@/shared/composables/useMobile'
import { useUiStore } from '@/domains/editor/store/ui.store'
import { useExportStore } from '@/domains/export/store/export.store'
import { useProjectsStore } from '@/domains/workspace/store/projects.store'
import { createProjectRouteSync } from '@/domains/workspace/application/project-route-sync'

// Layouts
import DesktopLayout from '@/domains/editor/ui/layouts/DesktopLayout.vue'
import MobileLayout from '@/domains/editor/ui/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/domains/editor/ui/components/export/ExportModal.vue'
import MobileExportSheet from '@/domains/editor/ui/components/mobile/MobileExportSheet.vue'
import DiffModal from '@/domains/editor/ui/components/DiffModal.vue'
import PagePreviewModal from '@/domains/editor/ui/components/PagePreviewModal.vue'

// ============================================
// Initialization
// ============================================

// Initialize stores and actions
const ui = useUiStore()
const exportState = useExportStore()
const actions = useDocumentActions()
provideDocumentActions(actions)
const projects = useProjectsStore()
const { isMobile } = useMobile()
const {
  hasOpenModal: hasOpenUiModal,
  showPreviewModal,
  previewPageRef,
  showDiffModal,
  diffPages,
} = storeToRefs(ui)
const { showExportModal, exportSelectedOnly } = storeToRefs(exportState)
const hasOpenModal = computed(() => hasOpenUiModal.value || showExportModal.value)
const { setFileInputRef } = useFileInput()
const route = useRoute()
const router = useRouter()
const routeSync = createProjectRouteSync({
  switchProject: (projectId) => projects.switchProject(projectId),
  redirectToDashboard: () => router.replace('/'),
})

// Initialize keyboard shortcuts (desktop only)
useKeyboardShortcuts(actions, { isModalOpen: hasOpenModal })

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
    await projects.persistActiveProject()
  } catch (error) {
    console.error('Failed to persist project before leaving:', error)
  }
})

onBeforeUnmount(() => {
  setFileInputRef(null)
})
</script>
<template>
  <div
    class="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden supports-[height:100dvh]:h-[100dvh]"
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
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="exportState.closeExportModal"
      @success="actions.handleExportSuccess"
    />
    <ExportModal
      v-else
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="exportState.closeExportModal"
      @success="actions.handleExportSuccess"
    />

    <!-- Page Preview Modal -->
    <PagePreviewModal
      :open="showPreviewModal"
      @update:open="(val: boolean) => !val && actions.handleClosePreview()"
      :page-ref="previewPageRef"
      @navigate="ui.navigatePreview"
    />

    <!-- Ghost Overlay -->
    <DiffModal
      :open="showDiffModal"
      @update:open="(val: boolean) => !val && ui.closeDiffModal()"
      :pages="diffPages"
      @close="ui.closeDiffModal"
    />
  </div>
</template>

<style scoped>
/* Minimal styles - layout-specific styles live in layout components */
</style>

