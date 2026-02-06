<script setup lang="ts">
/**
 * EditorView - Project workspace shell
 *
 * Owns document state + editor layouts and loads project data on route changes.
 */

import { watch, watchEffect, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

// Composables
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { provideDocumentActions, useDocumentActions } from '@/composables/useDocumentActions'
import { useFileInput } from '@/composables/useFileInput'
import { useMobile } from '@/composables/useMobile'
import { useUiStore } from '@/stores/ui'
import { useProjectsStore } from '@/stores/projects'

// Layouts
import DesktopLayout from '@/layouts/DesktopLayout.vue'
import MobileLayout from '@/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/components/export/ExportModal.vue'
import MobileExportSheet from '@/components/mobile/MobileExportSheet.vue'
import DiffModal from '@/components/DiffModal.vue'
import PagePreviewModal from '@/components/editor/PagePreviewModal.vue'

// ============================================
// Initialization
// ============================================

// Initialize stores and actions
const ui = useUiStore()
const actions = useDocumentActions()
provideDocumentActions(actions)
const projects = useProjectsStore()
const { isMobile } = useMobile()
const {
  hasOpenModal,
  showExportModal,
  exportSelectedOnly,
  showPreviewModal,
  previewPageRef,
  showDiffModal,
  diffPages,
} = storeToRefs(ui)
const { setFileInputRef } = useFileInput()
const route = useRoute()
const router = useRouter()

// Initialize keyboard shortcuts (desktop only)
useKeyboardShortcuts(actions, { isModalOpen: hasOpenModal })

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

watchEffect(() => {
  setFileInputRef(fileInput.value ?? null)
})

async function loadFromRoute(param: string | string[] | undefined) {
  if (!param || Array.isArray(param)) return
  const ok = await projects.switchProject(param)
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
    await projects.persistActiveProject()
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
      @close="ui.closeExportModal"
      @success="actions.handleExportSuccess"
    />
    <ExportModal
      v-else
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="ui.closeExportModal"
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
