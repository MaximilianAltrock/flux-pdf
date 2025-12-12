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
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useTheme } from '@/composables/useTheme'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useToast } from '@/composables/useToast'
import { useAppState } from '@/composables/useAppState'
import { useAppActions } from '@/composables/useAppActions'

// Layouts
import DesktopLayout from '@/layouts/DesktopLayout.vue'
import MobileLayout from '@/layouts/MobileLayout.vue'

// Shared Overlays (used by both layouts)
import ExportModal from '@/components/ExportModal.vue'
import DiffModal from '@/components/DiffModal.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { UserAction } from './types/actions'

// ============================================
// Initialization
// ============================================

const { initSession } = usePdfManager()
const { restoreHistory } = useCommandManager()
const toast = useToast()

// Initialize theme (handles flash prevention)
useTheme()

// Initialize app state and actions
const state = useAppState()
const actions = useAppActions(state)

// Initialize keyboard shortcuts (desktop only)
// We pass a callback that routes string actions to the correct handler
useKeyboardShortcuts((action: string) => {
  if (action === UserAction.OPEN_COMMAND_PALETTE) {
    state.openCommandPalette()
  } else {
    // Delegate all other actions (diff, duplicate, etc.) to the central Action handler
    actions.handleCommandAction(action)
  }
})

// ============================================
// Lifecycle
// ============================================

onMounted(async () => {
  await initSession()
  await restoreHistory()
})

// ============================================
// Export Success Handler (for toast notification)
// ============================================

function handleExportSuccess() {
  toast.success('PDF Exported')
}
</script>

<template>
  <div
    class="h-[100dvh] w-full flex flex-col bg-background text-text overflow-hidden supports-[height:100dvh]:h-[100dvh]"
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

    <!-- Export Modal -->
    <ExportModal
      :open="state.showExportModal.value"
      :export-selected="state.exportSelectedOnly.value"
      @close="state.closeExportModal"
      @success="handleExportSuccess"
    />

    <!-- Page Preview Modal -->
    <PagePreviewModal
      :open="state.showPreviewModal.value"
      :page-ref="state.previewPageRef.value"
      @close="state.closePreviewModal"
      @navigate="state.navigatePreview"
    />

    <!-- Ghost Overlay -->
    <DiffModal
      :open="state.showDiffModal.value"
      :pages="state.diffPages.value"
      @close="state.closeDiffModal"
    />

    <!-- Toast Notifications -->
    <ToastContainer />

    <!-- Confirmation Dialog -->
    <ConfirmDialog />
  </div>
</template>

<style scoped>
/* Minimal styles - layout-specific styles live in layout components */
</style>
