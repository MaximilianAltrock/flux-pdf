<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { ChevronRight, Crosshair, Link2Off } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import type { OutlineNode } from '@/types'

defineProps<{
  node: OutlineNode
  hasChildren: boolean
  isExpanded: boolean
  isEditing: boolean
  editingTitle: string
  isBroken: boolean
  isTargeting: boolean
}>()

const emit = defineEmits<{
  'update:editingTitle': [value: string]
  'set-rename-input-ref': [el: Element | ComponentPublicInstance | null]
  'rename-start': []
  'rename-commit': []
  'rename-cancel': []
  'context-open': [open: boolean]
  'target-mode': []
  'open-url-editor': []
  'clear-target': []
  'toggle-bold': []
  'toggle-italic': []
  'set-color': [color: string | undefined]
  'preview-color': [color: string]
  'delete-node': []
  'delete-branch': []
  'jump-to-page': [pageId: string | undefined]
}>()
</script>

<template>
  <div v-if="isEditing" class="flex items-center w-full h-full gap-0">
    <Button
      variant="ghost"
      size="icon-sm"
      class="mr-1 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-foreground"
      :style="{ visibility: hasChildren ? 'visible' : 'hidden' }"
      aria-label="Toggle section"
    >
      <ChevronRight class="w-3 h-3 transition-transform duration-200" :class="isExpanded ? 'rotate-90' : ''" />
    </Button>

    <div class="flex items-center min-w-0 max-w-full gap-1">
      <Input
        :ref="(el) => emit('set-rename-input-ref', el)"
        :model-value="editingTitle"
        class="h-6 text-xs px-2 py-0.5"
        @update:model-value="(value) => emit('update:editingTitle', String(value))"
        @keydown.enter.prevent="emit('rename-commit')"
        @keydown.esc.prevent="emit('rename-cancel')"
        @blur="emit('rename-commit')"
      />
    </div>
  </div>

  <ContextMenu v-else @update:open="(open) => emit('context-open', open)">
    <ContextMenuTrigger>
      <div class="flex w-full h-full gap-0" tabindex="0" @keydown.f2.prevent="emit('rename-start')">
        <Button
          variant="ghost"
          size="icon-sm"
          class="mr-1 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-foreground"
          :style="{ visibility: hasChildren ? 'visible' : 'hidden' }"
          aria-label="Toggle section"
        >
          <ChevronRight class="w-3 h-3 transition-transform duration-200" :class="isExpanded ? 'rotate-90' : ''" />
        </Button>

        <div class="flex min-w-0 max-w-full gap-1">
          <span
            class="text-xs truncate leading-none py-1 pr-2"
            :class="{
              'font-semibold': !node.isBold,
              'font-bold': node.isBold,
              italic: node.isItalic,
            }"
            :style="!isBroken && node.color ? { color: node.color } : undefined"
          >
            {{ node.title }}
          </span>
          <Link2Off v-if="isBroken" class="w-3 h-3 text-destructive/80" />
          <Badge
            v-if="isTargeting"
            variant="outline"
            class="ui-mono ui-2xs h-4 px-1.5 text-primary border-primary/40"
          >
            Targeting
          </Badge>

          <Button
            variant="ghost"
            size="icon-sm"
            class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-primary ml-auto"
            :style="{ visibility: node.dest.type === 'page' ? 'visible' : 'hidden' }"
            aria-label="Jump to section"
            @click.stop="emit('jump-to-page', node.dest.targetPageId)"
          >
            <Crosshair class="w-3 h-3" />
          </Button>
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent>
      <ContextMenuItem @select="emit('rename-start')">Rename</ContextMenuItem>
      <ContextMenuItem @select="emit('target-mode')">Set Target...</ContextMenuItem>
      <ContextMenuItem @select="emit('open-url-editor')">Set External URL...</ContextMenuItem>
      <ContextMenuItem @select="emit('clear-target')">Clear Target</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
        <ContextMenuSubContent class="w-48">
          <ContextMenuLabel inset class="text-xs text-muted-foreground">Text Style</ContextMenuLabel>
          <ContextMenuCheckboxItem :checked="Boolean(node.isBold)" @select="emit('toggle-bold')">
            Bold
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem :checked="Boolean(node.isItalic)" @select="emit('toggle-italic')">
            Italic
          </ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuLabel inset class="w-full text-xs text-muted-foreground">Color</ContextMenuLabel>
          <ContextMenuItem inset @select="emit('set-color', '#ef4444')">Red</ContextMenuItem>
          <ContextMenuItem inset @select="emit('set-color', '#22c55e')">Green</ContextMenuItem>
          <ContextMenuItem inset @select="emit('set-color', '#3b82f6')">Blue</ContextMenuItem>
          <ContextMenuItem inset @select.prevent class="w-full justify-between">
            <span class="text-sm">Custom</span>
            <ColorPicker
              :model-value="node.color ?? '#3b82f6'"
              size="icon-sm"
              variant="outline"
              class="h-6 w-6"
              @update:model-value="(value) => emit('preview-color', value)"
            />
          </ContextMenuItem>
          <ContextMenuItem inset @select="emit('set-color', undefined)">Clear Color</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem @select="emit('delete-node')">
        {{ node.children?.length ? 'Ungroup Children' : 'Remove Node' }}
      </ContextMenuItem>
      <ContextMenuItem class="text-destructive focus:text-destructive" @select="emit('delete-branch')">
        Remove Branch
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
