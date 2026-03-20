<script setup lang="ts">
import type { Component } from 'vue'
import { Copy, Play, Trash2 } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import type { Workflow } from '@/shared/types/workflow'

defineProps<{
  workflow: Workflow
  icon: Component
  runStatus: string | null
  actionsDisabled: boolean
  updatedAtLabel: string
  stepCountLabel: string
}>()

const emit = defineEmits<{
  duplicate: []
  run: []
  delete: []
  dropFiles: [event: DragEvent]
}>()
</script>

<template>
  <Card class="overflow-hidden p-0 gap-0">
    <div class="p-4 border-b border-border/50 space-y-2">
      <div class="flex items-center gap-2">
        <div class="ui-panel-muted rounded-md p-1.5">
          <component :is="icon" class="w-4 h-4" />
        </div>
        <h3 class="font-medium truncate">{{ workflow.name }}</h3>
      </div>
      <p class="ui-caption line-clamp-2 min-h-[2.5rem]">
        {{ workflow.description || 'No description yet.' }}
      </p>
      <p class="ui-caption">{{ stepCountLabel }} - Updated {{ updatedAtLabel }}</p>
    </div>

    <div class="p-4">
      <div
        class="rounded-md border border-dashed border-border px-3 py-5 text-center bg-muted/10"
        @dragover.prevent
        @drop.prevent="emit('dropFiles', $event)"
      >
        <p class="ui-caption">Drop PDFs here to process</p>
        <p v-if="runStatus" class="ui-caption text-primary mt-2">
          {{ runStatus }}
        </p>
      </div>
    </div>

    <div class="p-4 pt-0 grid grid-cols-2 gap-2">
      <Button
        size="sm"
        variant="outline"
        class="gap-2"
        :disabled="actionsDisabled"
        @click="emit('duplicate')"
      >
        <Copy class="w-4 h-4" />
        Duplicate
      </Button>
      <Button size="sm" :disabled="actionsDisabled" class="gap-2" @click="emit('run')">
        <Play class="w-4 h-4" />
        Run on...
      </Button>
      <Button
        size="sm"
        variant="outline"
        class="col-span-2 gap-2 text-destructive border-destructive/30 hover:text-destructive"
        :disabled="actionsDisabled"
        @click="emit('delete')"
      >
        <Trash2 class="w-4 h-4" />
        Delete
      </Button>
    </div>
  </Card>
</template>
