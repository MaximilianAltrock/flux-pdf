<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { Tree, TreeItem } from '@/shared/components/ui/tree'
import { Button } from '@/shared/components/ui/button'
import { FileText, Plus } from 'lucide-vue-next'
import type { OutlineNode } from '@/shared/types'
import { scrollToPageId } from '@/shared/utils/scroll-to-page'
import { setOutlineNodeStyle } from '@/shared/utils/outline-tree'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { useUiStore } from '@/domains/editor/store/ui.store'
import InspectorStructureHeader from './structure/InspectorStructureHeader.vue'
import InspectorStructureNode from './structure/InspectorStructureNode.vue'
import InspectorStructureUrlDialog from './structure/InspectorStructureUrlDialog.vue'

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

function setRenameInputRef(nodeId: string, el: Element | ComponentPublicInstance | null) {
  if (!el) {
    renameInputRefs.delete(nodeId)
    return
  }

  const inputEl =
    el instanceof HTMLInputElement
      ? el
      : '$el' in el && el.$el instanceof HTMLInputElement
        ? el.$el
        : null

  if (inputEl) {
    renameInputRefs.set(nodeId, inputEl)
    return
  }

  renameInputRefs.delete(nodeId)
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
      <InspectorStructureHeader
        :outline-dirty="document.outlineDirty"
        :has-broken-links="hasBrokenLinks"
        :is-targeting="ui.isOutlineTargeting"
        :target-node-title="outlineTargetNode?.title ?? null"
        @reset="actions.resetOutlineToFileStructure"
        @clean="actions.cleanBrokenOutlineNodes"
        @cancel-targeting="ui.endOutlineTargeting"
      />

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
            <InspectorStructureNode
              :node="item.value as OutlineNode"
              :has-children="item.hasChildren"
              :is-expanded="isExpanded"
              :is-editing="isEditing(item.value as OutlineNode)"
              :editing-title="editingTitle"
              :is-broken="isBroken(item.value as OutlineNode)"
              :is-targeting="isTargetingNode(item.value as OutlineNode)"
              @update:editing-title="(value) => (editingTitle = value)"
              @set-rename-input-ref="
                (el) => setRenameInputRef((item.value as OutlineNode).id, el)
              "
              @rename-start="startRename(item.value as OutlineNode)"
              @rename-commit="commitRename"
              @rename-cancel="cancelRename"
              @context-open="
                (open) => handleContextMenuOpenChange(open, item.value as OutlineNode)
              "
              @target-mode="handleSetTargetMode(item.value as OutlineNode)"
              @open-url-editor="openUrlEditor(item.value as OutlineNode)"
              @clear-target="handleClearTarget(item.value as OutlineNode)"
              @toggle-bold="handleToggleBold(item.value as OutlineNode)"
              @toggle-italic="handleToggleItalic(item.value as OutlineNode)"
              @set-color="(color) => handleSetColor(item.value as OutlineNode, color)"
              @preview-color="(color) => handlePreviewColor(item.value as OutlineNode, color)"
              @delete-node="actions.deleteOutlineNode((item.value as OutlineNode).id)"
              @delete-branch="actions.deleteOutlineBranch((item.value as OutlineNode).id)"
              @jump-to-page="scrollGridToPage"
            />
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

  <InspectorStructureUrlDialog
    :open="ui.showOutlineUrlDialog"
    v-model="urlDraft"
    @close="closeUrlEditor"
    @save="commitUrl"
  />
</template>

