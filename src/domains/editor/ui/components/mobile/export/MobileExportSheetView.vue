<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
} from '@/shared/components/ui/drawer'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import ExportConfiguration, { type ExportSettings } from '@/domains/editor/ui/components/export/ExportConfiguration.vue'
import ExportStatus, { type ExportStats } from '@/domains/editor/ui/components/export/ExportStatus.vue'
import MobileDrawerHeader from '@/domains/editor/ui/components/mobile/MobileDrawerHeader.vue'

const props = defineProps<{
  open: boolean
  isExporting: boolean
  exportProgress: number
  exportError: string | null
  exportComplete: boolean
  exportStats: ExportStats | null
  settings: ExportSettings
  isConfigValid: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
  export: []
  'update:settings': [value: ExportSettings]
  'update:valid': [value: boolean]
  retry: []
}>()
</script>

<template>
  <Drawer :open="props.open" @update:open="(value: boolean) => emit('update:open', value)">
    <DrawerContent class="h-[80vh]">
      <div class="mx-auto w-full max-w-sm flex flex-col h-full">
        <MobileDrawerHeader
          title="Export PDF"
          description="Configure export settings and generate the PDF."
        />

        <ScrollArea class="flex-1 min-h-0">
          <div class="px-4 pb-4 space-y-6">
            <ExportStatus
              v-if="props.isExporting || props.exportComplete || props.exportError"
              :is-exporting="props.isExporting"
              :progress="props.exportProgress"
              :error="props.exportError"
              :complete="props.exportComplete"
              :stats="props.exportStats"
              @retry="emit('retry')"
            />

            <ExportConfiguration
              v-else
              :settings="props.settings"
              @update:settings="emit('update:settings', $event)"
              @update:valid="emit('update:valid', $event)"
            />
          </div>
        </ScrollArea>

        <DrawerFooter class="pt-0">
          <div class="px-4 pb-4 flex items-center gap-3">
            <Button
              v-if="!props.exportComplete && !props.exportError"
              variant="ghost"
              class="flex-1 h-11 text-sm font-semibold"
              :disabled="props.isExporting"
              @click="emit('close')"
            >
              Cancel
            </Button>

            <Button
              v-if="props.exportComplete || props.exportError"
              class="flex-1 h-11 text-sm font-semibold"
              :disabled="props.isExporting"
              @click="emit('close')"
            >
              Close
            </Button>

            <Button
              v-else
              :disabled="!props.isConfigValid || props.isExporting"
              class="flex-1 h-11 text-sm font-semibold"
              @click="emit('export')"
            >
              <Download class="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>
