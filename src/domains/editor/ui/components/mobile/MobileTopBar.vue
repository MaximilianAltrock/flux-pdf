<script setup lang="ts">
import { computed } from 'vue'
import { useMobile } from '@/shared/composables/useMobile'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useUiStore } from '@/domains/editor/store/ui.store'
import { useDocumentStore } from '@/domains/document/store/document.store'
import MobileTopBarView from '@/domains/editor/ui/components/mobile/top-bar/MobileTopBarView.vue'
import { useMobileEditorMode } from '@/domains/editor/ui/useMobileEditorMode'

const actions = useDocumentActionsContext()
const ui = useUiStore()
const document = useDocumentStore()

const emit = defineEmits<{
  menu: []
  editTitle: []
}>()

const { haptic } = useMobile()
const { isSplit, isBrowse, isSelect, isMove } = useMobileEditorMode(
  () => ui.mobileMode,
  () => ui.currentTool,
)

const selectedCount = computed(() => document.selectedCount)
const displayTitle = computed(() => document.projectTitle || 'Untitled')
const hasPages = computed(() => document.pageCount > 0)
const pageCount = computed(() => document.pageCount)
const isAllSelected = computed(
  () => pageCount.value > 0 && selectedCount.value === pageCount.value,
)
const canUndo = computed(() => actions.canUndo.value)
const canRedo = computed(() => actions.canRedo.value)

function handleMenuTap() {
  haptic('light')
  emit('menu')
}

function handleTitleTap() {
  haptic('light')
  emit('editTitle')
}

function handleEnterSelect() {
  haptic('medium')
  actions.enterMobileSelectionMode()
}

function handleExitSelect() {
  haptic('light')
  actions.exitMobileSelectionMode()
}

function handleSelectAll() {
  actions.selectAllPages()
}

function handleDeselectAll() {
  actions.clearSelectionKeepMode()
}

function handleCancelMove() {
  haptic('light')
  actions.exitMobileMoveMode()
}

function handleExitSplit() {
  haptic('light')
  actions.exitMobileSplitMode()
}

function handleUndo() {
  if (!canUndo.value) return
  haptic('light')
  actions.undo()
}

function handleRedo() {
  if (!canRedo.value) return
  haptic('light')
  actions.redo()
}
</script>

<template>
  <MobileTopBarView
    :is-split="isSplit"
    :is-move="isMove"
    :is-select="isSelect"
    :is-browse="isBrowse"
    :selected-count="selectedCount"
    :display-title="displayTitle"
    :has-pages="hasPages"
    :is-all-selected="isAllSelected"
    :can-undo="canUndo"
    :can-redo="canRedo"
    @menu="handleMenuTap"
    @edit-title="handleTitleTap"
    @enter-select="handleEnterSelect"
    @exit-select="handleExitSelect"
    @select-all="handleSelectAll"
    @deselect-all="handleDeselectAll"
    @cancel-move="handleCancelMove"
    @exit-split="handleExitSplit"
    @undo="handleUndo"
    @redo="handleRedo"
  />
</template>


