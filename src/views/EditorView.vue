<script setup lang="ts">
/**
 * EditorView - Project workspace shell
 *
 * Owns document state + editor layouts and loads project data on route changes.
 */

import { watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

// Composables
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDocumentFacade } from '@/composables/useDocumentFacade'
import { useProjectManager } from '@/composables/useProjectManager'

// Layouts
import DesktopLayout from '@/layouts/DesktopLayout.vue'
import MobileLayout from '@/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/components/ExportModal.vue'
import MobileExportSheet from '@/components/mobile/MobileExportSheet.vue'
import DiffModal from '@/components/DiffModal.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'

// ============================================
// Initialization
// ============================================

// Initialize app state and actions
const { state, actions } = useDocumentFacade()
const route = useRoute()
const router = useRouter()
const projectManager = useProjectManager({
  zoom: state.zoom,
  setZoom: state.setZoom,
  setLoading: state.setLoading,
})

// Initialize keyboard shortcuts (desktop only)
useKeyboardShortcuts(actions, state, { isModalOpen: state.hasOpenModal })

async function loadFromRoute(param: string | string[] | undefined) {
  if (!param || Array.isArray(param)) return
  const ok = await projectManager.switchProject(param)
  if (!ok) {
    await router.replace('/')
  }
}

watch(
  () => route.params.id,
  (id) => {
    void loadFromRoute(id)
  },
  { immediate: true },
)

onBeforeRouteLeave(async () => {
  actions.commitProjectTitle()
  try {
    await projectManager.persistActiveProject()
  } catch (error) {
    console.error('Failed to persist project before leaving:', error)
  }
})
</script>
<template>
  <div
    class="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden supports-[height:100dvh]:h-[100dvh]"
  >
    <!-- Hidden File Input (shared across layouts) -->
    <input
      :ref="(el) => (state.fileInputRef.value = el as HTMLInputElement)"
      type="file"
      accept="application/pdf,.pdf,image/jpeg,image/png"
      multiple
      class="hidden"
      @change="actions.handleFileInputChange"
    />

    <!-- Mobile Layout -->
    <MobileLayout v-if="state.isMobile.value" :state="state" :actions="actions" />

    <!-- Desktop Layout -->
    <DesktopLayout v-else :state="state" :actions="actions" />

    <!-- ============================================
         Shared Overlays (render above both layouts)
         ============================================ -->

    <!-- Export Modal / Sheet -->
    <MobileExportSheet
      v-if="state.isMobile.value"
      :open="state.showExportModal.value"
      :export-selected="state.exportSelectedOnly.value"
      :state="state"
      :actions="actions"
      @close="state.closeExportModal"
      @success="actions.handleExportSuccess"
    />
    <ExportModal
      v-else
      :open="state.showExportModal.value"
      :export-selected="state.exportSelectedOnly.value"
      :state="state"
      :actions="actions"
      @close="state.closeExportModal"
      @success="actions.handleExportSuccess"
    />

    <!-- Page Preview Modal -->
    <PagePreviewModal
      :open="state.showPreviewModal.value"
      @update:open="(val: boolean) => !val && actions.handleClosePreview()"
      :page-ref="state.previewPageRef.value"
      :state="state"
      :actions="actions"
      @navigate="state.navigatePreview"
    />

    <!-- Ghost Overlay -->
    <DiffModal
      :open="state.showDiffModal.value"
      @update:open="(val: boolean) => !val && state.closeDiffModal()"
      :pages="state.diffPages.value"
      @close="state.closeDiffModal"
    />
  </div>
</template>

<style scoped>
/* Minimal styles - layout-specific styles live in layout components */
</style>
