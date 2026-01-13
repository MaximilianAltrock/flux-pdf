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
      class="text-center py-8 bg-card/30 rounded-2xl border border-border/40 shadow-sm backdrop-blur-sm"
    >
      <div class="relative inline-block mb-4">
        <div class="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"></div>
        <CheckCircle class="w-16 h-16 text-emerald-500 relative z-10" />
      </div>
      <h3 class="text-lg font-bold tracking-tight text-foreground mb-1">Export Successful</h3>
      <p class="text-xs text-muted-foreground max-w-[240px] mx-auto mb-4">
        Your professional document has been generated and downloaded.
      </p>

      <div
        v-if="stats"
        class="flex flex-col gap-1 p-3 bg-background/80 rounded-xl border border-border/20 text-left w-full max-w-[320px] mx-auto"
      >
        <div
          class="flex justify-between items-center text-xxs font-bold uppercase tracking-wider text-muted-foreground/60 gap-4"
        >
          <span class="shrink-0">Output Label</span>
          <span class="font-mono text-emerald-500 shrink-0">{{ stats.durationMs }}ms</span>
        </div>
        <div
          class="text-xs font-mono font-medium truncate text-foreground mb-1 min-w-0"
          :title="stats.filename"
        >
          {{ stats.filename }}
        </div>
        <div class="flex justify-between items-center pt-1.5 border-t border-border/20">
          <span class="text-xxs font-bold uppercase tracking-wider text-muted-foreground/60"
            >File Size</span
          >
          <div class="flex flex-col items-end">
            <span class="text-xs font-mono font-bold text-foreground">{{
              formatBytes(stats.sizeKB * 1024)
            }}</span>
            <span v-if="stats.compressionRatio" class="text-xxs font-mono text-emerald-500">
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
          <Button variant="ghost" class="bg-muted/10 hover:bg-muted/20" @click="emit('retry')">
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
        <div
          class="absolute inset-0 flex items-center justify-center font-mono font-bold text-base text-primary"
        >
          {{ progress }}%
        </div>
      </div>
      <div class="text-center space-y-1">
        <span class="text-base font-bold tracking-tight text-foreground block">Generating PDF</span>
        <span
          class="text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] animate-pulse"
          >Processing Assets...</span
        >
      </div>

      <div class="w-full max-w-xs mt-8 bg-muted/20 rounded-full h-1 overflow-hidden">
        <div
          class="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_var(--primary)]"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
