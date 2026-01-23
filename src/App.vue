<script setup lang="ts">
/**
 * App.vue - Application Root Coordinator
 *
 * This component serves as the minimal coordinator that:
 * 1. Initializes the application (session, theme, shortcuts)
 * 2. Delegates state management to useAppState
 * 3. Delegates business logic to useAppActions
 * 4. Renders the appropriate layout (Mobile vs Desktop)
 * 5. Renders shared overlays (modals, toasts, dialogs)
 *
 * All business logic has been extracted to composables.
 * All layout-specific UI has been extracted to layout components.
 */

import { onMounted } from 'vue'

// Composables
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDocumentFacade } from '@/composables/useDocumentFacade'

// Layouts
import DesktopLayout from '@/layouts/DesktopLayout.vue'
import MobileLayout from '@/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/components/ExportModal.vue'
import MobileExportSheet from '@/components/mobile/MobileExportSheet.vue'
import DiffModal from '@/components/DiffModal.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'
import Toaster from '@/components/ui/sonner/Sonner.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { TooltipProvider } from '@/components/ui/tooltip'

import 'vue-sonner/style.css'

// ============================================
// Initialization
// ============================================

// Initialize app state and actions
const { state, actions } = useDocumentFacade()

// Initialize keyboard shortcuts (desktop only)
useKeyboardShortcuts(actions, state, { isModalOpen: state.hasOpenModal })

// ============================================
// Lifecycle
// ============================================

onMounted(async () => {
  await actions.handleRestoreSession()
})
</script>
<template>
  <TooltipProvider>
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

      <!-- Toast Notifications -->
      <Toaster />

      <!-- Confirmation Dialog -->
      <ConfirmDialog />
    </div>
  </TooltipProvider>
</template>

<style scoped>
/* Minimal styles - layout-specific styles live in layout components */
</style>
