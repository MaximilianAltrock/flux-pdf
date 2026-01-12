<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Settings,
  X,
} from 'lucide-vue-next'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useDocumentService, type ExportOptions } from '@/composables/useDocumentService'
import type { PageReference } from '@/types'
import type { CompressionQuality } from '@/composables/usePdfCompression'
import { useDocumentStore } from '@/stores/document'
import { useMobile } from '@/composables'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogScrollContent,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatBytes } from '@/utils/format-size'
const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const emit = defineEmits<{
  close: []
  success: [filename: string, sizeKB: number, durationMs: number]
}>()

const store = useDocumentStore()
const {
  exportJob,
  exportDocument,
  getSuggestedFilename,
  getEstimatedSize,
  clearExportError,
  parsePageRange,
  validatePageRange,
} = useDocumentService()

const isExporting = computed(() => exportJob.value.status === 'running')
const exportProgress = computed(() => exportJob.value.progress)
const exportError = computed(() => exportJob.value.error)

const { isMobile, onBackButton } = useMobile()

const filenameInputRef = ref<HTMLInputElement | null>(null)

// Form state
const filename = ref('')
const exportComplete = ref(false)
const activeTab = ref<'basic' | 'pages' | 'metadata' | 'options'>('basic')
const showAdvanced = ref(false)

// Export stats for the success toast
const exportStats = ref<{
  filename: string
  sizeKB: number
  durationMs: number
  originalSizeKB?: number
  compressionRatio?: number
} | null>(null)

// Page range
const pageRangeMode = ref<'all' | 'selected' | 'custom'>('all')
const customPageRange = ref('')
const pageRangeError = ref<string | null>(null)

const keywordsInput = ref('')

// Options
const compress = ref(true)
const compressionQuality = ref<CompressionQuality | 'none'>('ebook')

// Reset state when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      filename.value = getSuggestedFilename()
      exportComplete.value = false
      activeTab.value = 'basic'
      showAdvanced.value = false
      exportStats.value = null
      clearExportError()

      // Set page range mode based on prop
      if (props.exportSelected && store.selectedCount > 0) {
        pageRangeMode.value = 'selected'
      } else {
        pageRangeMode.value = 'all'
      }

      customPageRange.value = ''
      pageRangeError.value = null

      keywordsInput.value = ''

      compress.value = true
      compressionQuality.value = 'ebook'
    }
  },
)

// Computed
const pageCount = computed(() => {
  if (pageRangeMode.value === 'selected') {
    return store.selectedCount
  }
  if (pageRangeMode.value === 'custom' && customPageRange.value) {
    const validation = validatePageRange(customPageRange.value, store.contentPageCount)
    if (validation.valid) {
      return parsePageRange(customPageRange.value, store.contentPageCount).length
    }
  }
  return store.contentPageCount
})

const pagesToExport = computed(() => {
  if (pageRangeMode.value === 'all') {
    return store.contentPages
  }
  if (pageRangeMode.value === 'selected') {
    return store.selectedPages
  }
  if (pageRangeMode.value === 'custom' && customPageRange.value) {
    const validation = validatePageRange(customPageRange.value, store.contentPageCount)
    if (validation.valid) {
      const indices = parsePageRange(customPageRange.value, store.contentPageCount)
      return indices.map((i) => store.contentPages[i]).filter((p): p is PageReference => !!p)
    }
  }
  return []
})

const canExport = computed(() => {
  if (!filename.value.trim()) return false
  if (isExporting.value || exportComplete.value) return false

  if (pageRangeMode.value === 'custom') {
    const validation = validatePageRange(customPageRange.value, store.contentPageCount)
    if (!validation.valid) return false
  }

  if (pageRangeMode.value === 'selected' && store.selectedCount === 0) {
    return false
  }

  return true
})

const pageRangeDescription = computed(() => {
  switch (pageRangeMode.value) {
    case 'all':
      return `All ${store.contentPageCount} pages`
    case 'selected':
      return `${store.selectedCount} selected page${store.selectedCount === 1 ? '' : 's'}`
    case 'custom':
      if (pageRangeError.value) return pageRangeError.value
      return `${pageCount.value} page${pageCount.value === 1 ? '' : 's'} from custom range`
    default:
      return `${store.contentPageCount} pages`
  }
})

// Watch custom page range for validation
watch(customPageRange, (value) => {
  if (pageRangeMode.value === 'custom' && value) {
    const validation = validatePageRange(value, store.contentPageCount)
    pageRangeError.value = validation.valid ? null : (validation.error ?? 'Invalid range')
  } else {
    pageRangeError.value = null
  }
})

// Methods
function buildExportOptions(): ExportOptions {
  const title = store.metadata.title?.trim() || store.projectTitle?.trim()
  const exportMetadata = {
    ...store.metadata,
    title: title ?? store.metadata.title,
  }

  const options: ExportOptions = {
    filename: filename.value.trim(),
    compress: compress.value,
    compressionQuality: compressionQuality.value,
    metadata: exportMetadata,
  }

  // Page range
  if (pageRangeMode.value === 'selected') {
    const selectedIndices = store.contentPages
      .map((p, i) => (store.selection.selectedIds.has(p.id) ? i + 1 : null))
      .filter((i): i is number => i !== null)
    options.pageRange = selectedIndices.join(', ')
  } else if (pageRangeMode.value === 'custom') {
    options.pageRange = customPageRange.value
  }

  return options
}

async function handleExport() {
  const startTime = performance.now()

  try {
    const options = buildExportOptions()
    // ...
    const result = await exportDocument(options)
    if (!result.ok) return

    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)

    exportStats.value = {
      filename: result.value.filename,
      sizeKB: Math.round(result.value.size / 1024),
      durationMs,
      originalSizeKB: result.value.originalSize
        ? Math.round(result.value.originalSize / 1024)
        : undefined,
      compressionRatio: result.value.compressionRatio,
    }
    // ...

    exportComplete.value = true
    emit(
      'success',
      exportStats.value.filename,
      exportStats.value.sizeKB,
      exportStats.value.durationMs,
    )
  } catch {
    // Error is handled in composable
  }
}

function handleClose() {
  if (!isExporting.value) {
    emit('close')
  }
}

function onOpenChange(val: boolean) {
  if (!val) {
    handleClose()
  }
}

function resetError() {
  clearExportError()
}

if (isMobile.value) {
  onBackButton(
    computed(() => props.open),
    () => emit('close'),
  )
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogScrollContent class="sm:max-w-xl p-0 overflow-hidden bg-background/98">
      <DialogHeader
        class="h-14 border-b border-border/40 flex items-center justify-between px-6 bg-card/50 backdrop-blur-md shrink-0 space-y-0 flex-row z-50 antialiased"
      >
        <div class="flex flex-col">
          <span
            class="text-xxs font-bold tracking-[0.2em] uppercase text-muted-foreground/60 leading-none mb-1"
          >
            Production Pipeline
          </span>
          <DialogTitle class="text-sm font-semibold flex items-center gap-2">
            <Download class="w-4 h-4 text-primary" />
            EXPORT PDF
          </DialogTitle>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:rotate-90"
          :disabled="isExporting"
          @click="handleClose"
        >
          <X class="w-4 h-4" />
        </Button>
      </DialogHeader>

      <div class="px-6 py-6 pb-2">
        <div class="space-y-6">
          <!-- Export complete state -->
          <div
            v-if="exportComplete"
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
              v-if="exportStats"
              class="flex flex-col gap-1 p-3 bg-background/80 rounded-xl border border-border/20 text-left w-full max-w-[320px] mx-auto"
            >
              <div
                class="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 gap-4"
              >
                <span class="shrink-0">Output Label</span>
                <span class="font-mono text-emerald-500 shrink-0"
                  >{{ exportStats.durationMs }}ms</span
                >
              </div>
              <div
                class="text-xs font-mono font-medium truncate text-foreground mb-1 min-w-0"
                :title="exportStats.filename"
              >
                {{ exportStats.filename }}
              </div>
              <div class="flex justify-between items-center pt-1.5 border-t border-border/20">
                <span class="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60"
                  >File Size</span
                >
                <div class="flex flex-col items-end">
                  <span class="text-xs font-mono font-bold text-foreground">{{
                    formatBytes(exportStats.sizeKB * 1024)
                  }}</span>
                  <span
                    v-if="exportStats.compressionRatio"
                    class="text-[8px] font-mono text-emerald-500"
                  >
                    -{{ Math.round(exportStats.compressionRatio * 100) }}% ({{
                      formatBytes(exportStats.originalSizeKB! * 1024)
                    }})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error state -->
          <div v-else-if="exportError" class="py-6">
            <Alert variant="destructive" class="max-w-md mx-auto">
              <AlertCircle class="w-4 h-4" />
              <AlertTitle>Export Failed</AlertTitle>
              <AlertDescription class="mt-2 text-sm">
                {{ exportError }}
              </AlertDescription>
              <div class="mt-3">
                <Button variant="ghost" class="bg-muted/10 hover:bg-muted/20" @click="resetError">
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
                {{ exportProgress }}%
              </div>
            </div>
            <div class="text-center space-y-1">
              <span class="text-base font-bold tracking-tight text-foreground block"
                >Generating PDF</span
              >
              <span
                class="text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] animate-pulse"
                >Processing Assets...</span
              >
            </div>

            <div class="w-full max-w-xs mt-8 bg-muted/20 rounded-full h-1 overflow-hidden">
              <div
                class="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_var(--primary)]"
                :style="{ width: `${exportProgress}%` }"
              ></div>
            </div>
          </div>

          <!-- Form -->
          <div v-else class="space-y-6">
            <!-- File info summary -->
            <div
              class="flex items-center gap-4 p-4 bg-card border border-border/40 rounded-xl shadow-sm"
            >
              <div
                class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0"
              >
                <FileText class="w-5 h-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                  <span
                    class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60"
                    >Export Target</span
                  >
                  <span
                    class="text-[9px] font-mono font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded"
                    >{{ pageCount }} PAGES</span
                  >
                </div>
                <p class="text-sm font-semibold text-foreground truncate">
                  {{ pageRangeDescription }}
                </p>
                <p class="text-[9px] font-mono text-muted-foreground">
                  Est. size:
                  <span class="text-foreground/80">{{
                    formatBytes(getEstimatedSize(pagesToExport))
                  }}</span>
                  <span class="ml-1 text-[8px] opacity-50"
                    >({{ getEstimatedSize(pagesToExport) }} B)</span
                  >
                </p>
              </div>
            </div>

            <!-- Filename -->
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <Label
                  for="filename"
                  class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80"
                >
                  Output Filename
                </Label>
              </div>
              <InputGroup class="bg-card/50">
                <InputGroupInput
                  id="filename"
                  ref="filenameInputRef"
                  v-model="filename"
                  type="text"
                  placeholder="untitled-project"
                  class="h-10 font-mono text-sm border-border/40 focus-visible:ring-primary/20"
                />
                <InputGroupAddon align="inline-end" class="border-border/40">
                  <InputGroupText class="font-mono text-xs opacity-60">.pdf</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>

            <!-- Page Range -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <Label
                  class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80"
                  >Page Context</Label
                >
              </div>

              <RadioGroup
                :model-value="pageRangeMode"
                @update:model-value="(v) => (pageRangeMode = v as 'all' | 'selected' | 'custom')"
                class="grid grid-cols-1 gap-2"
              >
                <div class="relative">
                  <RadioGroupItem id="range-all" value="all" class="peer sr-only" />
                  <Label
                    for="range-all"
                    class="flex items-center justify-between px-4 h-11 rounded-xl border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                  >
                    <span class="text-sm font-medium">Whole Document</span>
                    <span class="text-[9px] font-mono text-muted-foreground"
                      >{{ store.pageCount }} pages</span
                    >
                  </Label>
                </div>

                <div class="relative">
                  <RadioGroupItem
                    id="range-selected"
                    value="selected"
                    :disabled="store.selectedCount === 0"
                    class="peer sr-only"
                  />
                  <Label
                    for="range-selected"
                    class="flex items-center justify-between px-4 h-11 rounded-xl border border-border/40 bg-card/30 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    :class="
                      store.selectedCount > 0
                        ? 'cursor-pointer hover:bg-muted/40'
                        : 'opacity-50 cursor-not-allowed grayscale bg-muted/20'
                    "
                  >
                    <span class="text-sm font-medium">Selected Frames</span>
                    <span class="text-[9px] font-mono text-muted-foreground"
                      >{{ store.selectedCount }} items</span
                    >
                  </Label>
                </div>

                <div class="relative">
                  <RadioGroupItem id="range-custom" value="custom" class="peer sr-only" />
                  <Label
                    for="range-custom"
                    class="flex items-center justify-between px-4 h-11 rounded-xl border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                  >
                    <span class="text-sm font-medium">Manual Range</span>
                    <span class="text-[9px] font-mono text-muted-foreground">User defined</span>
                  </Label>
                </div>
              </RadioGroup>

              <div
                v-if="pageRangeMode === 'custom'"
                class="pt-1 animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <Input
                  v-model="customPageRange"
                  type="text"
                  placeholder="e.g., 1-5, 8, 10-12"
                  class="h-10 font-mono text-xs border-border/40 px-4 bg-muted/20"
                  :class="
                    pageRangeError
                      ? 'border-destructive focus-visible:ring-destructive/20'
                      : 'focus-visible:ring-primary/20'
                  "
                />
                <p
                  v-if="pageRangeError"
                  class="text-[9px] font-bold text-destructive mt-2 pl-1 uppercase"
                >
                  Error: {{ pageRangeError }}
                </p>
                <p
                  v-else
                  class="text-[9px] font-medium text-muted-foreground/60 mt-2 pl-1 tracking-tight"
                >
                  Enter comma-separated page numbers or ranges (e.g. 1-4, 7, 12).
                </p>
              </div>
            </div>

            <!-- Advanced Options Toggle -->
            <Collapsible
              v-model:open="showAdvanced"
              class="bg-muted/10 rounded-xl border border-border/20 overflow-hidden"
            >
              <CollapsibleTrigger as-child>
                <Button
                  type="button"
                  variant="ghost"
                  class="w-full h-10 px-4 py-0 justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                >
                  <div class="flex items-center gap-2">
                    <Settings class="w-3 h-3" />
                    System Parameters
                  </div>
                  <ChevronDown
                    class="w-3 h-3 transition-transform duration-300"
                    :class="showAdvanced ? 'rotate-180' : ''"
                  />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <!-- Advanced Options -->
                <div class="p-5 pt-0 grid grid-cols-1 gap-4">
                  <!-- Object Stream Compression -->
                  <div
                    class="flex items-center justify-between p-4 bg-background/50 border border-border/20 rounded-xl"
                  >
                    <div class="space-y-0.5">
                      <Label for="opt-compress" class="text-sm font-semibold cursor-pointer"
                        >Object Stream Compression</Label
                      >
                      <p class="text-xxs text-muted-foreground/70 font-medium">
                        Internal PDF structure optimization
                      </p>
                    </div>
                    <Checkbox
                      id="opt-compress"
                      :checked="compress"
                      @update:checked="(v: boolean) => (compress = v)"
                    />
                  </div>

                  <!-- Ghostscript Compression Quality -->
                  <div class="p-4 bg-background/50 border border-border/20 rounded-xl space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="space-y-0.5">
                        <Label class="text-sm font-semibold">PDF Compression (Ghostscript)</Label>
                        <p class="text-xxs text-muted-foreground/70 font-medium">
                          Reduce file size with image downsampling
                        </p>
                      </div>
                    </div>
                    <RadioGroup
                      :model-value="compressionQuality"
                      @update:model-value="
                        (v) => (compressionQuality = v as CompressionQuality | 'none')
                      "
                      class="grid grid-cols-2 gap-2"
                    >
                      <div class="relative">
                        <RadioGroupItem id="cq-none" value="none" class="peer sr-only" />
                        <Label
                          for="cq-none"
                          class="flex flex-col px-3 py-2 rounded-lg border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                        >
                          <span class="text-xs font-medium">Off</span>
                          <span class="text-xxs text-muted-foreground">No compression</span>
                        </Label>
                      </div>
                      <div class="relative">
                        <RadioGroupItem id="cq-screen" value="screen" class="peer sr-only" />
                        <Label
                          for="cq-screen"
                          class="flex flex-col px-3 py-2 rounded-lg border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                        >
                          <span class="text-xs font-medium">Screen</span>
                          <span class="text-xxs text-muted-foreground"
                            >72 dpi · Max compression</span
                          >
                        </Label>
                      </div>
                      <div class="relative">
                        <RadioGroupItem id="cq-ebook" value="ebook" class="peer sr-only" />
                        <Label
                          for="cq-ebook"
                          class="flex flex-col px-3 py-2 rounded-lg border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                        >
                          <span class="text-xs font-medium">Ebook</span>
                          <span class="text-xxs text-muted-foreground">150 dpi · Recommended</span>
                        </Label>
                      </div>
                      <div class="relative">
                        <RadioGroupItem id="cq-printer" value="printer" class="peer sr-only" />
                        <Label
                          for="cq-printer"
                          class="flex flex-col px-3 py-2 rounded-lg border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
                        >
                          <span class="text-xs font-medium">Printer</span>
                          <span class="text-xxs text-muted-foreground">300 dpi · High quality</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      <DialogFooter
        class="p-4 border-t border-border/40 glass-surface backdrop-blur-md flex items-center justify-end gap-3 shrink-0 z-50 antialiased"
      >
        <Button
          v-if="!exportComplete && !exportError"
          variant="ghost"
          class="h-9 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-muted transition-all"
          :disabled="isExporting"
          @click="handleClose"
        >
          Abort
        </Button>

        <Button
          v-if="exportComplete"
          class="h-9 px-6 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/10 transition-all"
          @click="handleClose"
        >
          Exit Process
        </Button>

        <Button
          v-else-if="!exportError"
          :disabled="!canExport"
          class="h-9 px-6 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95"
          @click="handleExport"
        >
          <Download class="w-3.5 h-3.5 mr-2" />
          Initialize ({{ pageCount }})
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
