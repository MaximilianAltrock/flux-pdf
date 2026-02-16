<script setup lang="ts">
import { RefreshCcw, Wrench } from 'lucide-vue-next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

defineProps<{
  outlineDirty: boolean
  hasBrokenLinks: boolean
  isTargeting: boolean
  targetNodeTitle: string | null
}>()

const emit = defineEmits<{
  reset: []
  clean: []
  cancelTargeting: []
}>()
</script>

<template>
  <div class="px-4 py-3 border-b border-border bg-sidebar">
    <div class="flex items-center justify-between gap-2">
      <p class="ui-kicker flex items-center gap-2">
        Document Structure
        <Badge variant="outline" class="ui-mono ui-2xs h-4 px-1.5">
          {{ outlineDirty ? 'Custom' : 'Auto' }}
        </Badge>
      </p>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="emit('reset')">
          <RefreshCcw class="w-3 h-3 mr-1" />
          Reset
        </Button>
        <Button
          v-if="hasBrokenLinks"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-xs text-destructive"
          @click="emit('clean')"
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
      v-if="isTargeting"
      class="mt-2 flex items-center justify-between ui-panel-muted rounded-sm px-2 py-1"
    >
      <span class="ui-caption text-muted-foreground">
        <template v-if="targetNodeTitle">
          Targeting
          <span class="font-medium text-foreground">
            {{ targetNodeTitle }}
          </span>
          . Click a page to set the outline target.
        </template>
        <template v-else>
          Select an outline item, then click a page to set the target.
        </template>
      </span>
      <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="emit('cancelTargeting')">
        Cancel
      </Button>
    </div>
  </div>
</template>
