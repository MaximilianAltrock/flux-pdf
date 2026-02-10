<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuLabel,
} from '@/components/ui/context-menu'
import { RotateCw, RotateCcw, Trash2, Copy, Eye, CheckSquare, Download } from 'lucide-vue-next'
import PdfThumbnail from '@/components/editor/PdfThumbnail.vue'
import { UserAction } from '@/types/actions'
import type { PageReference } from '@/types'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'
import { useUiStore } from '@/stores/ui'
import type { GridInteractionPolicy } from '@/composables/useGridInteractionPolicy'
import { withPrimaryModifier } from '@/utils/shortcuts'

const props = defineProps<{
  page: PageReference
  index: number
  pageNumber: number
  selected: boolean
  isStartOfFile: boolean
  interactionPolicy: GridInteractionPolicy
  problemSeverity?: 'error' | 'warning' | 'info'
  problemMessages?: string[]
}>()

const emit = defineEmits<{
  preview: [pageRef: PageReference]
  contextAction: [action: UserAction, pageRef: PageReference]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const ui = useUiStore()
const selectAllShortcut = withPrimaryModifier('A')

function handlePageClick(event: MouseEvent | KeyboardEvent) {
  if (actions.completeOutlineTargeting(props.page.id)) {
    return
  }
  if (props.interactionPolicy.tool === 'razor') {
    const pages = document.pages
    const index = pages.findIndex((p) => p.id === props.page.id)
    const prevPage = pages[index - 1]

    // Prevent invalid splits
    if (index > 0 && index < pages.length - 1 && prevPage && !prevPage.isDivider) {
      actions.handleSplitGroup(index)
    }
    return
  }
  if (!props.interactionPolicy.allowSelection) {
    return
  }

  // Selection Logic
  if (event.metaKey || event.ctrlKey) {
    actions.togglePageSelection(props.page.id)
  } else if (event.shiftKey && document.lastSelectedId) {
    actions.selectRange(document.lastSelectedId, props.page.id)
  } else {
    const isOnlySelected =
      document.selectedIds.has(props.page.id) && document.selectedCount === 1
    if (isOnlySelected) {
      actions.clearSelection()
    } else {
      actions.selectPage(props.page.id, false)
    }
  }
}

function handlePreview() {
  emit('preview', props.page)
}

function handleDelete() {
  emit('contextAction', UserAction.DELETE, props.page)
}

function handleRotate() {
  emit('contextAction', UserAction.ROTATE_RIGHT, props.page)
}

function handleVisible(pageId: string) {
  document.setActivePageId(pageId)
}

function handleContextMenu(event: MouseEvent) {
  if (props.interactionPolicy.allowContextMenu) return
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger>
      <PdfThumbnail
        :page-ref="page"
        :page-number="pageNumber"
        :selected="selected"
        :fixed-size="true"
        :width="ui.zoom"
        :source-color="document.getSourceColor(page.sourceFileId)"
        :is-start-of-file="isStartOfFile"
        :is-razor-active="interactionPolicy.tool === 'razor'"
        :actions-disabled="!interactionPolicy.allowThumbnailActions"
        :hover-disabled="!interactionPolicy.showHoverEffects"
        :can-split="index > 0"
        :problem-severity="problemSeverity"
        :problem-messages="problemMessages"
        @contextmenu="handleContextMenu"
        @click="handlePageClick"
        @preview="handlePreview"
        @delete="handleDelete"
        @rotate="handleRotate"
        @visible="handleVisible"
      />
    </ContextMenuTrigger>

    <ContextMenuContent v-if="interactionPolicy.allowContextMenu">
      <!-- Header/Label -->
      <ContextMenuLabel
        class="text-xs text-muted-foreground font-medium border-b border-border px-3 py-2"
      >
        {{
          document.selectedCount > 1
            ? `${document.selectedCount} pages selected`
            : `Page ${pageNumber}`
        }}
      </ContextMenuLabel>

      <ContextMenuItem @select="handlePreview">
        <Eye class="w-4 h-4 mr-2 text-muted-foreground" />
        <span>Preview</span>
        <ContextMenuShortcut>Space</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem @select="emit('contextAction', UserAction.DUPLICATE, page)">
        <Copy class="w-4 h-4 mr-2 text-muted-foreground" />
        <span>Duplicate</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_LEFT, page)">
        <RotateCcw class="w-4 h-4 mr-2 text-muted-foreground" />
        <span>Rotate Left</span>
        <ContextMenuShortcut>Shift+R</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_RIGHT, page)">
        <RotateCw class="w-4 h-4 mr-2 text-muted-foreground" />
        <span>Rotate Right</span>
        <ContextMenuShortcut>R</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <template v-if="document.selectedCount > 0">
        <ContextMenuItem @select="emit('contextAction', UserAction.SELECT_ALL, page)">
          <CheckSquare class="w-4 h-4 mr-2 text-muted-foreground" />
          <span>Select All</span>
          <ContextMenuShortcut>{{ selectAllShortcut }}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem @select="emit('contextAction', UserAction.EXPORT_SELECTED, page)">
          <Download class="w-4 h-4 mr-2 text-muted-foreground" />
          <span>Export Selected</span>
        </ContextMenuItem>

        <ContextMenuSeparator />
      </template>

      <ContextMenuItem
        class="text-destructive focus:text-destructive focus:bg-destructive/10"
        @select="handleDelete"
      >
        <Trash2 class="w-4 h-4 mr-2" />
        <span>Delete</span>
        <ContextMenuShortcut class="text-destructive/50">Del</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
