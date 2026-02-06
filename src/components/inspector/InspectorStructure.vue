<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorPicker } from '@/components/ui/color-picker'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronRight,
  Crosshair,
  FileText,
  Link2Off,
  Plus,
  RefreshCcw,
  Wrench,
} from 'lucide-vue-next'
import type { OutlineNode } from '@/types'
import { scrollToPageId } from '@/utils/scroll-to-page'
import { setOutlineNodeStyle } from '@/utils/outline-tree'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'
import { useUiStore } from '@/stores/ui'

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const ui = useUiStore()

const outlineTree = computed(() => document.outlineTree as OutlineNode[])
const pageIdSet = computed(() => new Set(document.contentPages.map((p) => p.id)))
const activePageId = computed(() => document.activePageId)
const editingNodeId = ref<string | null>(null)
const editingTitle = ref('')
const renameInputRefs = new Map<string, HTMLInputElement>()
const urlEditorNodeId = ref<string | null>(null)
const urlDraft = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)
const originalColorByNodeId = new Map<string, string | undefined>()
const pendingColorByNodeId = new Map<string, string | undefined>()

const brokenNodeIds = computed(() => {
  const ids = new Set<string>()
  const walk = (nodes: OutlineNode[]) => {
    for (const node of nodes) {
      if (node.dest.type === 'page') {
        const target = node.dest.targetPageId
        if (!target || !pageIdSet.value.has(target)) {
          ids.add(node.id)
        }
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(outlineTree.value)
  return ids
})

const hasBrokenLinks = computed(() => brokenNodeIds.value.size > 0)
const outlineTargetNode = computed(() => {
  const nodeId = ui.outlineTargetNodeId
  if (!nodeId) return null
  return findNodeById(outlineTree.value, nodeId)
})

function scrollGridToPage(pageId?: string) {
  if (!pageId) return
  const didScroll = scrollToPageId(pageId, { behavior: 'smooth', block: 'center' })
  if (didScroll) {
    actions.selectPage(pageId, false)
  }
}

function addCustomOutlineNode() {
  const pageId = document.lastSelectedId
  if (!pageId) return
  actions.addOutlineNodeForPage(pageId)
}

function serializeStructure(nodes: OutlineNode[]): string {
  return nodes.map((node) => `${node.id}[${serializeStructure(node.children ?? [])}]`).join('|')
}

function handleOutlineUpdate(nextTree: OutlineNode[]) {
  const prevStructure = serializeStructure(outlineTree.value)
  const nextStructure = serializeStructure(nextTree)
  if (prevStructure === nextStructure) {
    document.setOutlineTree(nextTree, false)
    return
  }
  actions.updateOutlineTree(nextTree, { name: 'Reorder outline', nextDirty: true })
}

function isBroken(node: OutlineNode) {
  return brokenNodeIds.value.has(node.id)
}

function isActive(node: OutlineNode) {
  const target = node.dest.type === 'page' ? node.dest.targetPageId : undefined
  return target && target === activePageId.value
}

function isEditing(node: OutlineNode) {
  return editingNodeId.value === node.id
}

function isTargetingNode(node: OutlineNode) {
  return ui.isOutlineTargeting && ui.outlineTargetNodeId === node.id
}

function findNodeById(nodes: OutlineNode[], nodeId: string): OutlineNode | null {
  for (const node of nodes ?? []) {
    if (node.id === nodeId) return node
    if (node.children?.length) {
      const match = findNodeById(node.children, nodeId)
      if (match) return match
    }
  }
  return null
}

function setRenameInputRef(nodeId: string, el: ComponentPublicInstance | null) {
  if (el) {
    renameInputRefs.set(nodeId, el.$el as HTMLInputElement)
  } else {
    renameInputRefs.delete(nodeId)
  }
}

function startRename(node: OutlineNode) {
  editingNodeId.value = node.id
  editingTitle.value = node.title
  nextTick(() => {
    const input = renameInputRefs.get(node.id)
    input?.focus()
    input?.select()
  })
}

function cancelRename() {
  editingNodeId.value = null
  editingTitle.value = ''
}

function commitRename() {
  const nodeId = editingNodeId.value
  if (!nodeId) return
  const node = findNodeById(outlineTree.value, nodeId)
  const next = editingTitle.value.trim()
  if (!node || !next || next === node.title) {
    cancelRename()
    return
  }
  actions.renameOutlineNode(nodeId, next)
  cancelRename()
}

function handleSetTargetMode(node: OutlineNode) {
  actions.beginOutlineTargeting(node.id)
}

function handleContextMenuOpenChange(isOpen: boolean, node: OutlineNode) {
  if (isOpen) {
    originalColorByNodeId.set(node.id, node.color)
    pendingColorByNodeId.delete(node.id)
    return
  }
  const hasPending = pendingColorByNodeId.has(node.id)
  if (!hasPending) {
    originalColorByNodeId.delete(node.id)
    return
  }
  const originalColor = originalColorByNodeId.get(node.id)
  const pendingColor = pendingColorByNodeId.get(node.id)
  originalColorByNodeId.delete(node.id)
  pendingColorByNodeId.delete(node.id)

  if (pendingColor === originalColor) {
    return
  }

  const currentTree = outlineTree.value
  const previousTree = setOutlineNodeStyle(currentTree, node.id, { color: originalColor })
  const nextTree = setOutlineNodeStyle(currentTree, node.id, { color: pendingColor })
  document.setOutlineTree(previousTree, false)
  actions.updateOutlineTree(nextTree, { name: 'Update outline style', nextDirty: true })
}

function openUrlEditor(node: OutlineNode) {
  urlEditorNodeId.value = node.id
  urlDraft.value = node.dest.type === 'external-url' ? (node.dest.url ?? '') : ''
  ui.openOutlineUrlDialog()
  nextTick(() => {
    urlInputRef.value?.focus()
    urlInputRef.value?.select()
  })
}

function closeUrlEditor() {
  ui.closeOutlineUrlDialog()
  urlEditorNodeId.value = null
  urlDraft.value = ''
}

function commitUrl() {
  const nodeId = urlEditorNodeId.value
  if (!nodeId) return
  const node = findNodeById(outlineTree.value, nodeId)
  const next = urlDraft.value.trim()
  if (!node || !next) {
    closeUrlEditor()
    return
  }
  if (node.dest.type === 'external-url' && (node.dest.url ?? '') === next) {
    closeUrlEditor()
    return
  }
  actions.setOutlineNodeUrl(nodeId, next)
  closeUrlEditor()
}

function handleClearTarget(node: OutlineNode) {
  actions.clearOutlineNodeTarget(node.id)
}

function handleToggleBold(node: OutlineNode) {
  actions.updateOutlineNodeStyle(node.id, { isBold: !node.isBold })
}

function handleToggleItalic(node: OutlineNode) {
  actions.updateOutlineNodeStyle(node.id, { isItalic: !node.isItalic })
}

function handleSetColor(node: OutlineNode, color?: string) {
  pendingColorByNodeId.delete(node.id)
  originalColorByNodeId.delete(node.id)
  actions.updateOutlineNodeStyle(node.id, { color })
}

function handlePreviewColor(node: OutlineNode, color: string) {
  if (!originalColorByNodeId.has(node.id)) {
    originalColorByNodeId.set(node.id, node.color)
  }
  pendingColorByNodeId.set(node.id, color)
  const nextTree = setOutlineNodeStyle(outlineTree.value, node.id, { color })
  document.setOutlineTree(nextTree, false)
}
</script>

<template>
  <div class="flex-1 min-h-0">
    <div v-if="document.pageCount === 0" class="p-12 text-center">
      <div
        class="ui-panel-muted w-10 h-10 flex items-center justify-center mx-auto mb-3 rounded-md"
      >
        <FileText class="w-6 h-6 text-muted-foreground" />
      </div>
      <p class="ui-label text-muted-foreground">No pages imported</p>
      <p class="ui-caption mt-1">Import files to see structure</p>
    </div>

    <div v-else class="flex flex-col min-h-0">
      <div class="px-4 py-3 border-b border-border bg-sidebar">
        <div class="flex items-center justify-between gap-2">
          <p class="ui-kicker flex items-center gap-2">
            Document Structure
            <Badge variant="outline" class="ui-mono ui-2xs h-4 px-1.5">
              {{ document.outlineDirty ? 'Custom' : 'Auto' }}
            </Badge>
          </p>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="actions.resetOutlineToFileStructure"
            >
              <RefreshCcw class="w-3 h-3 mr-1" />
              Reset
            </Button>
            <Button
              v-if="hasBrokenLinks"
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs text-destructive"
              @click="actions.cleanBrokenOutlineNodes"
            >
              <Wrench class="w-3 h-3 mr-1" />
              Clean
            </Button>
          </div>
        </div>
        <p class="ui-caption mt-1.5 leading-relaxed">
          Drag & drop to reorder entries. Nest items to create hierarchies.
        </p>
        <div
          v-if="ui.isOutlineTargeting"
          class="mt-2 flex items-center justify-between ui-panel-muted rounded-sm px-2 py-1"
        >
          <span class="ui-caption text-muted-foreground">
            <template v-if="outlineTargetNode">
              Targeting
              <span class="font-medium text-foreground">
                {{ outlineTargetNode.title }}
              </span>
              . Click a page to set the outline target.
            </template>
            <template v-else>
              Select an outline item, then click a page to set the target.
            </template>
          </span>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            @click="ui.endOutlineTargeting"
          >
            Cancel
          </Button>
        </div>
      </div>

      <div class="flex-1 min-h-0 py-2">
        <Tree
          :items="outlineTree"
          :get-key="(item) => item.id"
          @update:items="(val) => handleOutlineUpdate(val as OutlineNode[])"
          @drop:page="({ targetId, pageId }) => actions.setOutlineNodeTarget(targetId, pageId)"
          class="w-full px-2"
          v-slot="{ flattenItems }"
        >
          <TreeItem
            v-for="item in flattenItems"
            :key="item._id"
            :item="item"
            v-slot="{ isExpanded }"
            class="group h-8 px-2 rounded-sm outline-none hover:bg-muted/20 cursor-default transition-colors focus-visible:ring-1 focus-visible:ring-primary/30 data-[selected]:bg-primary/10 data-[selected]:text-primary overflow-hidden mb-0.5"
            :class="{
              'bg-primary/10 text-primary': isActive(item.value as OutlineNode),
              'text-destructive': isBroken(item.value as OutlineNode),
              'ring-1 ring-primary/40': isTargetingNode(item.value as OutlineNode),
            }"
            :style="{ marginLeft: `${item.level * 12}px` }"
          >
            <div
              v-if="isEditing(item.value as OutlineNode)"
              class="flex items-center w-full h-full gap-0"
            >
              <!-- Expander -->
              <Button
                variant="ghost"
                size="icon-sm"
                class="mr-1 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-foreground"
                :style="{ visibility: item.hasChildren ? 'visible' : 'hidden' }"
                aria-label="Toggle section"
              >
                <ChevronRight
                  class="w-3 h-3 transition-transform duration-200"
                  :class="isExpanded ? 'rotate-90' : ''"
                />
              </Button>

              <!-- Title Container -->
              <div class="flex items-center min-w-0 max-w-full gap-1">
                <Input
                  :ref="(el) => setRenameInputRef((item.value as OutlineNode).id, el)"
                  v-model="editingTitle"
                  class="h-6 text-xs px-2 py-0.5"
                  @keydown.enter.prevent="commitRename"
                  @keydown.esc.prevent="cancelRename"
                  @blur="commitRename"
                />
              </div>
            </div>

            <ContextMenu
              v-else
              @update:open="(open) => handleContextMenuOpenChange(open, item.value as OutlineNode)"
            >
              <ContextMenuTrigger>
                <div
                  class="flex w-full h-full gap-0"
                  tabindex="0"
                  @keydown.f2.prevent="startRename(item.value as OutlineNode)"
                >
                  <!-- Expander -->
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="mr-1 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-foreground"
                    :style="{ visibility: item.hasChildren ? 'visible' : 'hidden' }"
                    aria-label="Toggle section"
                  >
                    <ChevronRight
                      class="w-3 h-3 transition-transform duration-200"
                      :class="isExpanded ? 'rotate-90' : ''"
                    />
                  </Button>

                  <!-- Title Container -->
                  <div class="flex min-w-0 max-w-full gap-1">
                    <span
                      class="text-xs truncate leading-none py-1 pr-2"
                      :class="{
                        'font-semibold': !(item.value as OutlineNode).isBold,
                        'font-bold': (item.value as OutlineNode).isBold,
                        italic: (item.value as OutlineNode).isItalic,
                      }"
                      :style="
                        !isBroken(item.value as OutlineNode) && (item.value as OutlineNode).color
                          ? { color: (item.value as OutlineNode).color }
                          : undefined
                      "
                    >
                      {{ (item.value as OutlineNode).title }}
                    </span>
                    <Link2Off
                      v-if="isBroken(item.value as OutlineNode)"
                      class="w-3 h-3 text-destructive/80"
                    />
                    <Badge
                      v-if="isTargetingNode(item.value as OutlineNode)"
                      variant="outline"
                      class="ui-mono ui-2xs h-4 px-1.5 text-primary border-primary/40"
                    >
                      Targeting
                    </Badge>

                    <!-- Target Action - Attached to Title -->
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-primary ml-auto"
                      :style="{
                        visibility:
                          (item.value as OutlineNode).dest.type === 'page' ? 'visible' : 'hidden',
                      }"
                      aria-label="Jump to section"
                      @click.stop="scrollGridToPage((item.value as OutlineNode).dest.targetPageId)"
                    >
                      <Crosshair class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent>
                <ContextMenuItem @select="startRename(item.value as OutlineNode)">
                  Rename
                </ContextMenuItem>
                <ContextMenuItem @select="handleSetTargetMode(item.value as OutlineNode)">
                  Set Target...
                </ContextMenuItem>
                <ContextMenuItem @select="openUrlEditor(item.value as OutlineNode)">
                  Set External URL...
                </ContextMenuItem>
                <ContextMenuItem @select="handleClearTarget(item.value as OutlineNode)">
                  Clear Target
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
                  <ContextMenuSubContent class="w-48">
                    <ContextMenuLabel inset class="text-xs text-muted-foreground">
                      Text Style
                    </ContextMenuLabel>
                    <ContextMenuCheckboxItem
                      :checked="Boolean((item.value as OutlineNode).isBold)"
                      @select="handleToggleBold(item.value as OutlineNode)"
                    >
                      Bold
                    </ContextMenuCheckboxItem>
                    <ContextMenuCheckboxItem
                      :checked="Boolean((item.value as OutlineNode).isItalic)"
                      @select="handleToggleItalic(item.value as OutlineNode)"
                    >
                      Italic
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuLabel inset class="w-full text-xs text-muted-foreground">
                      Color
                    </ContextMenuLabel>
                    <ContextMenuItem
                      inset
                      @select="handleSetColor(item.value as OutlineNode, '#ef4444')"
                    >
                      Red
                    </ContextMenuItem>
                    <ContextMenuItem
                      inset
                      @select="handleSetColor(item.value as OutlineNode, '#22c55e')"
                    >
                      Green
                    </ContextMenuItem>
                    <ContextMenuItem
                      inset
                      @select="handleSetColor(item.value as OutlineNode, '#3b82f6')"
                    >
                      Blue
                    </ContextMenuItem>
                    <ContextMenuItem inset @select.prevent class="w-full justify-between">
                      <span class="text-sm">Custom</span>
                      <ColorPicker
                        :model-value="(item.value as OutlineNode).color ?? '#3b82f6'"
                        size="icon-sm"
                        variant="outline"
                        class="h-6 w-6"
                        @update:model-value="
                          (value) => handlePreviewColor(item.value as OutlineNode, value)
                        "
                      />
                    </ContextMenuItem>
                    <ContextMenuItem
                      inset
                      @select="handleSetColor(item.value as OutlineNode, undefined)"
                    >
                      Clear Color
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem
                  @select="actions.deleteOutlineNode((item.value as OutlineNode).id)"
                >
                  {{
                    (item.value as OutlineNode).children?.length
                      ? 'Ungroup Children'
                      : 'Remove Node'
                  }}
                </ContextMenuItem>
                <ContextMenuItem
                  class="text-destructive focus:text-destructive"
                  @select="actions.deleteOutlineBranch((item.value as OutlineNode).id)"
                >
                  Remove Branch
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </TreeItem>
        </Tree>
      </div>

      <div class="mx-4 mb-4 mt-2 p-3 rounded-md text-center">
        <Button
          variant="secondary"
          size="sm"
          class="w-full ui-label h-7"
          @click="addCustomOutlineNode"
        >
          <Plus class="w-3 h-3 mr-1.5 text-primary" />
          New Bookmark
        </Button>
      </div>
    </div>
  </div>

  <Dialog
    :open="ui.showOutlineUrlDialog"
    @update:open="(value) => (value ? null : closeUrlEditor())"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Set external URL</DialogTitle>
        <DialogDescription>
          Add a link that opens when this outline item is selected.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <Label for="outline-url">URL</Label>
        <Input
          id="outline-url"
          ref="urlInputRef"
          v-model="urlDraft"
          type="url"
          placeholder="https://example.com"
          @keydown.enter.prevent="commitUrl"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="closeUrlEditor">Cancel</Button>
        <Button @click="commitUrl">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
