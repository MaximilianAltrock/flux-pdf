<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Settings,
} from 'lucide-vue-next'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  usePdfExport,
  parsePageRange,
  validatePageRange,
  type ExportOptions,
} from '@/composables/usePdfExport'
import { useDocumentStore } from '@/stores/document'
import { useMobile } from '@/composables'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogScrollContent,
} from '@/components/ui/dialog'

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
  isExporting,
  exportProgress,
  exportError,
  exportWithOptions,
  getSuggestedFilename,
  getEstimatedSize,
} = usePdfExport()

const { isMobile, onBackButton } = useMobile()

const filenameInputRef = ref<HTMLInputElement | null>(null)

// Form state
const filename = ref('')
const exportComplete = ref(false)
const activeTab = ref<'basic' | 'pages' | 'metadata' | 'options'>('basic')
const showAdvanced = ref(false)

// Export stats for the success toast
const exportStats = ref<{ filename: string; sizeKB: number; durationMs: number } | null>(null)

// Page range
const pageRangeMode = ref<'all' | 'selected' | 'custom'>('all')
const customPageRange = ref('')
const pageRangeError = ref<string | null>(null)

const keywordsInput = ref('')

// Options
const compress = ref(true)

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
    }
  },
)

// Computed
const pageCount = computed(() => {
  if (pageRangeMode.value === 'selected') {
    return store.selectedCount
  }
  if (pageRangeMode.value === 'custom' && customPageRange.value) {
    const validation = validatePageRange(customPageRange.value, store.pageCount)
    if (validation.valid) {
      return parsePageRange(customPageRange.value, store.pageCount).length
    }
  }
  return store.pageCount
})

const canExport = computed(() => {
  if (!filename.value.trim()) return false
  if (isExporting.value || exportComplete.value) return false

  if (pageRangeMode.value === 'custom') {
    const validation = validatePageRange(customPageRange.value, store.pageCount)
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
      return `All ${store.pageCount} pages`
    case 'selected':
      return `${store.selectedCount} selected page${store.selectedCount === 1 ? '' : 's'}`
    case 'custom':
      if (pageRangeError.value) return pageRangeError.value
      return `${pageCount.value} page${pageCount.value === 1 ? '' : 's'} from custom range`
    default:
      return `${store.pageCount} pages`
  }
})

// Watch custom page range for validation
watch(customPageRange, (value) => {
  if (pageRangeMode.value === 'custom' && value) {
    const validation = validatePageRange(value, store.pageCount)
    pageRangeError.value = validation.valid ? null : (validation.error ?? 'Invalid range')
  } else {
    pageRangeError.value = null
  }
})

// Methods
function buildExportOptions(): ExportOptions {
  const options: ExportOptions = {
    filename: filename.value.trim(),
    compress: compress.value,
  }

  // Page range
  if (pageRangeMode.value === 'selected') {
    const selectedIndices = store.pages
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
    await exportWithOptions(options)

    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)

    // Estimate file size (rough approximation based on source files)
    let totalSize = 0
    for (const source of store.sourceFileList) {
      totalSize += source.fileSize
    }
    const avgPageSize = totalSize / Math.max(1, store.pages.length)
    const estimatedSizeKB = Math.round((avgPageSize * pageCount.value) / 1024)

    exportStats.value = {
      filename: `${options.filename}.pdf`,
      sizeKB: estimatedSizeKB,
      durationMs,
    }

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
  exportError.value = null
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
    <DialogScrollContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Export PDF</DialogTitle>
      </DialogHeader>

      <div class="py-4">
        <!-- Export complete state -->
        <div v-if="exportComplete" class="text-center py-8">
          <CheckCircle class="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 class="text-lg font-medium text-text mb-2">Export Complete!</h3>
          <p class="text-sm text-text-muted">Your PDF has been downloaded successfully.</p>
          <p v-if="exportStats" class="text-xs font-mono text-emerald-500 mt-2">
            {{ exportStats.filename }} • {{ exportStats.durationMs }}ms
          </p>
        </div>

        <!-- Error state -->
        <div v-else-if="exportError" class="text-center py-8">
          <AlertCircle class="w-16 h-16 text-danger mx-auto mb-4" />
          <h3 class="text-lg font-medium text-text mb-2">Export Failed</h3>
          <p class="text-sm text-danger mb-4">{{ exportError }}</p>
          <Button
            variant="ghost"
            class="bg-muted/10 hover:bg-muted/20"
            @click="resetError"
          >
            Try Again
          </Button>
        </div>

        <!-- Exporting state -->
        <div v-else-if="isExporting" class="py-8">
          <div class="flex items-center justify-center gap-3 mb-4">
            <svg class="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span class="text-text font-medium">Generating PDF...</span>
          </div>
          <div class="w-full bg-muted/20 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300 ease-out"
              :style="{ width: `${exportProgress}%` }"
            />
          </div>
          <p class="text-center text-sm text-text-muted mt-2">{{ exportProgress }}% complete</p>
        </div>

        <!-- Form -->
        <div v-else class="space-y-4">
          <!-- File info summary -->
          <div class="flex items-center gap-3 p-3 bg-muted/5 rounded-lg">
            <FileText class="w-8 h-8 text-primary flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text">{{ pageRangeDescription }}</p>
              <p class="text-xs text-text-muted">Estimated size: {{ getEstimatedSize() }}</p>
            </div>
          </div>

          <!-- Filename -->
          <div>
            <Label for="filename" class="mb-1 block">
              Filename
            </Label>
            <div class="flex items-center gap-2">
              <Input
                id="filename"
                ref="filenameInputRef"
                v-model="filename"
                type="text"
                placeholder="Enter filename"
                class="flex-1"
              />
              <span class="text-text-muted text-sm">.pdf</span>
            </div>
          </div>

          <!-- Page Range -->
          <div>
            <Label class="text-text mb-2 block font-medium">Pages to Export</Label>
            <RadioGroup
              :model-value="pageRangeMode"
              @update:model-value="(v) => pageRangeMode = (v as 'all' | 'selected' | 'custom')"
            >
              <div class="flex items-center gap-2">
                <RadioGroupItem id="range-all" value="all" />
                <Label for="range-all" class="cursor-pointer font-normal">
                  All pages ({{ store.pageCount }})
                </Label>
              </div>

              <div class="flex items-center gap-2">
                <RadioGroupItem
                  id="range-selected"
                  value="selected"
                  :disabled="store.selectedCount === 0"
                />
                <Label
                  for="range-selected"
                  class="font-normal"
                  :class="store.selectedCount > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'"
                >
                  Selected pages ({{ store.selectedCount }})
                </Label>
              </div>

              <div class="flex items-center gap-2">
                <RadioGroupItem id="range-custom" value="custom" />
                <Label for="range-custom" class="cursor-pointer font-normal">
                  Custom range
                </Label>
              </div>
            </RadioGroup>

              <div v-if="pageRangeMode === 'custom'" class="pl-6 pt-2">
                <Input
                  v-model="customPageRange"
                  type="text"
                  placeholder="e.g., 1-5, 8, 10-12"
                  :class="pageRangeError ? 'border-danger' : 'border-border'"
                />
                <p v-if="pageRangeError" class="text-xs text-danger mt-1">
                  {{ pageRangeError }}
                </p>
                <p v-else class="text-xs text-text-muted mt-1">
                  Enter page numbers and/or ranges separated by commas
                </p>
              </div>
          </div>

          <!-- Advanced Options Toggle -->
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
            @click="showAdvanced = !showAdvanced"
          >
            <ChevronDown
              class="w-4 h-4 transition-transform"
              :class="showAdvanced ? 'rotate-180' : ''"
            />
            Advanced options
          </button>

          <!-- Advanced Options -->
          <div v-if="showAdvanced" class="space-y-4 pl-2 border-l-2 border-border">
            <!-- Options Section -->
            <div>
              <h4 class="text-sm font-medium text-text mb-2 flex items-center gap-2">
                <Settings class="w-4 h-4" />
                Export Options
              </h4>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="opt-compress"
                  :checked="compress"
                  @update:checked="(v: boolean) => compress = v"
                />
                <Label
                  for="opt-compress"
                  class="cursor-pointer"
                >
                  Optimize file size
                </Label>
              </div>
              <p class="text-xs text-text-muted mt-1 pl-6">
                Uses object streams for smaller file size
              </p>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          v-if="!exportComplete && !exportError"
          variant="ghost"
          :disabled="isExporting"
          @click="handleClose"
        >
          Cancel
        </Button>

        <Button
          v-if="exportComplete"
          @click="handleClose"
        >
          Done
        </Button>

        <Button
          v-else-if="!exportError"
          :disabled="!canExport"
          @click="handleExport"
        >
          <Download class="w-4 h-4 mr-2" />
          Export {{ pageCount }} Page{{ pageCount === 1 ? '' : 's' }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
