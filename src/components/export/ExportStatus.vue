<script setup lang="ts">
import { CheckCircle, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatBytes } from '@/utils/format'

export type ExportStats = {
  filename: string
  sizeKB: number
  durationMs: number
  originalSizeKB?: number
  compressionRatio?: number
}

defineProps<{
  isExporting: boolean
  progress: number
  error: string | null
  complete: boolean
  stats: ExportStats | null
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div>
    <!-- Export complete state -->
    <div
      v-if="complete"
      class="text-center py-8 bg-card rounded-md border border-border shadow-sm"
    >
      <div class="relative inline-block mb-4">
        <div class="absolute inset-0 bg-primary/10 rounded-full"></div>
        <CheckCircle class="w-16 h-16 text-primary relative z-10" />
      </div>
      <h3 class="text-lg font-bold tracking-tight text-foreground mb-1">Export Successful</h3>
      <p class="ui-caption max-w-[240px] mx-auto mb-4">
        Your professional document has been generated and downloaded.
      </p>

      <div
        v-if="stats"
        class="ui-panel flex flex-col gap-1 p-3 rounded-md text-left w-full max-w-[320px] mx-auto"
      >
        <div
          class="flex justify-between items-center ui-kicker text-muted-foreground/70 gap-4"
        >
          <span class="shrink-0">Output Label</span>
          <span class="ui-mono text-primary shrink-0">{{ stats.durationMs }}ms</span>
        </div>
        <div
          class="ui-mono text-xs font-medium truncate text-foreground mb-1 min-w-0"
          :title="stats.filename"
        >
          {{ stats.filename }}
        </div>
        <div class="flex justify-between items-center pt-1.5 border-t border-border/30">
          <span class="ui-kicker text-muted-foreground/70">File Size</span>
          <div class="flex flex-col items-end">
            <span class="ui-mono text-xs font-semibold text-foreground">{{
              formatBytes(stats.sizeKB * 1024)
            }}</span>
            <span v-if="stats.compressionRatio" class="ui-mono text-xs text-primary">
              -{{ Math.round(stats.compressionRatio * 100) }}% ({{
                formatBytes(stats.originalSizeKB! * 1024)
              }})
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-6">
      <Alert variant="destructive" class="max-w-md mx-auto">
        <AlertCircle class="w-4 h-4" />
        <AlertTitle>Export Failed</AlertTitle>
        <AlertDescription class="mt-2 text-sm">
          {{ error }}
        </AlertDescription>
        <div class="mt-3">
          <Button variant="secondary" @click="emit('retry')">
            Try Again
          </Button>
        </div>
      </Alert>
    </div>

    <!-- Exporting state -->
    <div v-else-if="isExporting" class="py-8 flex flex-col items-center">
      <div class="relative w-20 h-20 mb-6">
        <div class="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
        <div
          class="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
        <div class="absolute inset-0 flex items-center justify-center ui-mono text-base text-primary">
          {{ progress }}%
        </div>
      </div>
      <div class="text-center space-y-1">
        <span class="text-base font-bold tracking-tight text-foreground block">Generating PDF</span>
        <span class="ui-kicker ui-mono opacity-70">Processing Assets...</span>
      </div>

      <div class="w-full max-w-xs mt-8 bg-muted/20 rounded-full h-1 overflow-hidden">
        <div
          class="h-full bg-primary transition-all duration-300"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
