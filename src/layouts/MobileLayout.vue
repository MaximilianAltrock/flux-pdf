<script setup lang="ts">
import { computed } from 'vue'

// Mobile Components
import MobileTopBar from '@/components/mobile/MobileTopBar.vue'
import MobilePageGrid from '@/components/mobile/MobilePageGrid.vue'
import MobileBottomBar from '@/components/mobile/MobileBottomBar.vue'
import MobileFAB from '@/components/mobile/MobileFAB.vue'
import MobileMenuDrawer from '@/components/mobile/MobileMenuDrawer.vue'
import MobileTitleSheet from '@/components/mobile/MobileTitleSheet.vue'
import MobileAddSheet from '@/components/mobile/MobileAddSheet.vue'
import MobileActionSheet from '@/components/mobile/MobileActionSheet.vue'
import { Spinner } from '@/components/ui/spinner'

import type { PageReference } from '@/types'
import type { FacadeState } from '@/composables/useDocumentFacade'
import type { AppActions } from '@/composables/useAppActions'

// Props - receive state and actions from parent
const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

// Local computed for template readability
const hasPages = computed(() => props.state.document.pageCount > 0)
const selectedCount = computed(() => props.state.document.selectedCount)
const isLoading = computed(() => props.state.isLoading.value)
const loadingMessage = computed(() => props.state.loadingMessage.value)

// Event handlers
function onPreview(pageRef: PageReference) {
  props.actions.handlePagePreview(pageRef)
}

function onRemoveSource(sourceId: string) {
  props.actions.handleRemoveSource(sourceId)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Safe Area Top -->
    <div class="pt-[env(safe-area-inset-top)]">
      <MobileTopBar
        :selection-mode="props.state.mobileSelectionMode.value"
        :selected-count="selectedCount"
        :state="props.state"
        :actions="props.actions"
        @menu="props.state.openMenuDrawer"
        @edit-title="props.state.openTitleSheet"
      />
    </div>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden relative">
      <!-- Empty State -->
      <div v-if="!hasPages" class="h-full flex flex-col items-center justify-center p-8">
        <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <svg class="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-2">No PDFs yet</h2>
        <p class="text-sm text-muted-foreground text-center mb-6">
          Tap the + button to add your first PDF
        </p>
      </div>

      <!-- Page Grid -->
      <MobilePageGrid
        v-else
        :selection-mode="props.state.mobileSelectionMode.value"
        :state="props.state"
        :actions="props.actions"
        @preview="onPreview"
      />

      <!-- Loading Overlay -->
      <Transition name="fade">
        <div
          v-if="isLoading"
          class="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-50"
        >
          <Spinner class="w-12 h-12 text-primary mb-4" />
          <span class="text-muted-foreground font-medium">{{ loadingMessage }}</span>
        </div>
      </Transition>
    </main>

    <!-- Safe Area Bottom -->
    <div class="pb-[env(safe-area-inset-bottom)]">
      <MobileBottomBar
        :selection-mode="props.state.mobileSelectionMode.value"
        :selected-count="selectedCount"
        :has-pages="hasPages"
        @rotate-left="props.actions.handleRotateSelected(-90)"
        @rotate-right="props.actions.handleRotateSelected(90)"
        @delete="props.actions.handleDeleteSelected"
        @duplicate="props.actions.handleDuplicateSelected"
        @export="props.actions.handleExport"
      />
    </div>

    <!-- Floating Action Button -->
    <MobileFAB
      :selection-mode="props.state.mobileSelectionMode.value"
      :selected-count="selectedCount"
      @add="props.state.openAddSheet"
      @actions="props.state.openActionSheet"
    />

    <!-- Mobile Sheets & Drawers -->
    <MobileMenuDrawer
      :open="props.state.showMenuDrawer.value"
      :state="props.state"
      :actions="props.actions"
      @update:open="(val) => !val && props.state.closeMenuDrawer()"
      @removeSource="onRemoveSource"
      @new-project="props.actions.handleNewProject"
    />

    <MobileTitleSheet
      :open="props.state.showTitleSheet.value"
      :state="props.state"
      :actions="props.actions"
      @update:open="(val) => !val && props.state.closeTitleSheet()"
    />

    <MobileAddSheet
      :open="props.state.showAddSheet.value"
      :state="props.state"
      @update:open="(val) => !val && props.state.closeAddSheet()"
      @select-files="props.actions.handleMobileAddFiles"
      @take-photo="props.actions.handleMobileTakePhoto"
    />

    <MobileActionSheet
      :open="props.state.showActionSheet.value"
      :selected-count="selectedCount"
      @update:open="(val) => !val && props.state.closeActionSheet()"
      @rotate-left="props.actions.handleRotateSelected(-90)"
      @rotate-right="props.actions.handleRotateSelected(90)"
      @duplicate="props.actions.handleDuplicateSelected"
      @delete="props.actions.handleDeleteSelected"
      @export-selected="props.actions.handleExportSelected"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
