<script setup lang="ts">
import { Database, Trash2, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import type { SettingsStorageSegmentView } from '@/shared/types/settings'

defineProps<{
  segments: ReadonlyArray<SettingsStorageSegmentView>
  storageUsedLabel: string
  storageQuotaLabel: string
  isStorageBusy: boolean
  hasTrashData: boolean
  hasCacheData: boolean
}>()

const emit = defineEmits<{
  refresh: []
  emptyTrash: []
  clearCache: []
  nuke: []
}>()
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-1">
      <h2 class="text-base font-semibold">Storage Management</h2>
      <p class="ui-caption">Monitor local disk usage and run cleanup actions.</p>
    </div>

    <div class="ui-panel-muted rounded-md p-4 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <p class="ui-label">Disk Utility</p>
        <Button type="button" size="sm" variant="outline" :disabled="isStorageBusy" @click="emit('refresh')">
          Refresh
        </Button>
      </div>

      <div class="h-3 w-full rounded-full overflow-hidden border border-border/60 bg-background/70 flex">
        <div
          v-for="segment in segments"
          :key="segment.id"
          class="h-full transition-[width] duration-300"
          :class="segment.barClass"
          :style="{ width: `${segment.widthPercent}%` }"
        />
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="segment in segments"
          :key="`legend-${segment.id}`"
          class="rounded-md border border-border/50 bg-background/70 px-3 py-2 flex items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="segment.dotClass" />
            <span class="ui-caption">{{ segment.label }}</span>
          </div>
          <span class="ui-mono ui-caption">{{ segment.bytesLabel }}</span>
        </div>
      </div>

      <p class="ui-caption">
        FluxPDF data: <span class="ui-mono">{{ storageUsedLabel }}</span>
        <span> - Quota: <span class="ui-mono">{{ storageQuotaLabel }}</span></span>
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div class="ui-panel-muted rounded-md p-4 space-y-3">
        <div class="space-y-1">
          <p class="ui-label">Trash</p>
          <p class="ui-caption">Permanently removes trashed projects and their unused sources.</p>
        </div>
        <Button
          type="button"
          class="w-full gap-2"
          variant="outline"
          :disabled="isStorageBusy || !hasTrashData"
          @click="emit('emptyTrash')"
        >
          <Trash2 class="w-4 h-4" />
          Empty Trash
        </Button>
      </div>

      <div class="ui-panel-muted rounded-md p-4 space-y-3">
        <div class="space-y-1">
          <p class="ui-label">Cache</p>
          <p class="ui-caption">Runs file garbage collection and clears runtime document caches.</p>
        </div>
        <Button
          type="button"
          class="w-full gap-2"
          variant="outline"
          :disabled="isStorageBusy || !hasCacheData"
          @click="emit('clearCache')"
        >
          <Database class="w-4 h-4" />
          Clear Cache
        </Button>
      </div>

      <div class="ui-panel-muted rounded-md p-4 space-y-3 border-destructive/30">
        <div class="space-y-1">
          <p class="ui-label text-destructive">Danger Zone</p>
          <p class="ui-caption">Deletes all projects, workflows, and local settings from this browser.</p>
        </div>
        <Button
          type="button"
          class="w-full gap-2 text-destructive border-destructive/40 hover:text-destructive"
          variant="outline"
          :disabled="isStorageBusy"
          @click="emit('nuke')"
        >
          <TriangleAlert class="w-4 h-4" />
          Nuke
        </Button>
      </div>
    </div>
  </section>
</template>
