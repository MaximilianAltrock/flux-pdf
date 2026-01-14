<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { FileText, Settings, ChevronDown } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatBytes } from '@/utils/format'
import type { PageReference } from '@/types'
import type { CompressionQuality } from '@/composables/usePdfCompression'
import type { FacadeState } from '@/composables/useDocumentFacade'
import type { AppActions } from '@/composables/useAppActions'

export interface ExportSettings {
  filename: string
  pageRangeMode: 'all' | 'selected' | 'custom'
  customPageRange: string
  compress: boolean
  compressionQuality: CompressionQuality | 'none'
}

const props = defineProps<{
  state: FacadeState
  actions: AppActions
  settings: ExportSettings
}>()

const emit = defineEmits<{
  'update:settings': [value: ExportSettings]
  'update:valid': [value: boolean]
}>()

const document = props.state.document
const { getEstimatedSize, parsePageRange, validatePageRange } = props.actions

const filenameInputRef = ref<HTMLInputElement | null>(null)
const pageRangeError = ref<string | null>(null)
const showAdvanced = ref(false)

// Local proxy for settings to avoid deep mutation issues
const localSettings = ref<ExportSettings>({ ...props.settings })

watch(
  () => props.settings,
  (newVal) => {
    localSettings.value = { ...newVal }
  },
  { deep: true },
)

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', newVal)
    validateForm()
  },
  { deep: true },
)

// Computed
const pageCount = computed(() => {
  if (localSettings.value.pageRangeMode === 'selected') {
    return document.selectedCount
  }
  if (localSettings.value.pageRangeMode === 'custom' && localSettings.value.customPageRange) {
    const validation = validatePageRange(
      localSettings.value.customPageRange,
      document.contentPageCount,
    )
    if (validation.valid) {
      return parsePageRange(localSettings.value.customPageRange, document.contentPageCount).length
    }
  }
  return document.contentPageCount
})

const pagesToExport = computed(() => {
  if (localSettings.value.pageRangeMode === 'all') {
    return document.contentPages
  }
  if (localSettings.value.pageRangeMode === 'selected') {
    return document.selectedPages
  }
  if (localSettings.value.pageRangeMode === 'custom' && localSettings.value.customPageRange) {
    const validation = validatePageRange(
      localSettings.value.customPageRange,
      document.contentPageCount,
    )
    if (validation.valid) {
      const indices = parsePageRange(localSettings.value.customPageRange, document.contentPageCount)
      return indices.map((i) => document.contentPages[i]).filter((p): p is PageReference => !!p)
    }
  }
  return []
})

const pageRangeDescription = computed(() => {
  switch (localSettings.value.pageRangeMode) {
    case 'all':
      return `All ${document.contentPageCount} pages`
    case 'selected':
      return `${document.selectedCount} selected page${document.selectedCount === 1 ? '' : 's'}`
    case 'custom':
      if (pageRangeError.value) return pageRangeError.value
      return `${pageCount.value} page${pageCount.value === 1 ? '' : 's'} from custom range`
    default:
      return `${document.contentPageCount} pages`
  }
})

function validateForm() {
  let isValid = true

  if (!localSettings.value.filename.trim()) isValid = false

  if (localSettings.value.pageRangeMode === 'custom') {
    const validation = validatePageRange(
      localSettings.value.customPageRange,
      document.contentPageCount,
    )
    pageRangeError.value = validation.valid ? null : (validation.error ?? 'Invalid range')
    if (!validation.valid) isValid = false
  } else {
    pageRangeError.value = null
  }

  if (localSettings.value.pageRangeMode === 'selected' && document.selectedCount === 0) {
    isValid = false
  }

  emit('update:valid', isValid)
}

onMounted(() => {
  validateForm()
})
</script>

<template>
  <div class="space-y-6">
    <!-- File info summary -->
    <div class="flex items-center gap-4 p-4 bg-card border border-border/40 rounded-xl shadow-sm">
      <div
        class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0"
      >
        <FileText class="w-5 h-5 text-primary" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-0.5">
          <span class="text-xxs font-bold uppercase tracking-widest text-muted-foreground"
            >Export Target</span
          >
          <span
            class="text-xxs font-mono font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded"
            >{{ pageCount }} PAGES</span
          >
        </div>
        <p class="text-sm font-semibold text-foreground truncate">
          {{ pageRangeDescription }}
        </p>
        <p class="text-xxs font-mono text-muted-foreground">
          Est. size:
          <span class="text-foreground/80">{{ formatBytes(getEstimatedSize(pagesToExport)) }}</span>
          <span class="ml-1 text-xxs opacity-50">({{ getEstimatedSize(pagesToExport) }} B)</span>
        </p>
      </div>
    </div>

    <!-- Filename -->
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <Label
          for="filename"
          class="text-xxs font-bold uppercase tracking-widest text-muted-foreground"
        >
          Output Filename
        </Label>
      </div>
      <InputGroup class="bg-card/50">
        <InputGroupInput
          id="filename"
          ref="filenameInputRef"
          v-model="localSettings.filename"
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
        <Label class="text-xxs font-bold uppercase tracking-widest text-muted-foreground"
          >Page Context</Label
        >
      </div>

      <RadioGroup v-model="localSettings.pageRangeMode" class="grid grid-cols-1 gap-2">
        <div class="relative">
          <RadioGroupItem id="range-all" value="all" class="peer sr-only" />
          <Label
            for="range-all"
            class="flex items-center justify-between px-4 h-11 rounded-xl border border-border/40 bg-card/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/40"
          >
            <span class="text-sm font-medium">Whole Document</span>
            <span class="text-xxs font-mono text-muted-foreground"
              >{{ document.pageCount }} pages</span
            >
          </Label>
        </div>

        <div class="relative">
          <RadioGroupItem
            id="range-selected"
            value="selected"
            :disabled="document.selectedCount === 0"
            class="peer sr-only"
          />
          <Label
            for="range-selected"
            class="flex items-center justify-between px-4 h-11 rounded-xl border border-border/40 bg-card/30 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
            :class="
              document.selectedCount > 0
                ? 'cursor-pointer hover:bg-muted/40'
                : 'opacity-50 cursor-not-allowed grayscale bg-muted/20'
            "
          >
            <span class="text-sm font-medium">Selected Frames</span>
            <span class="text-xxs font-mono text-muted-foreground"
              >{{ document.selectedCount }} items</span
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
            <span class="text-xxs font-mono text-muted-foreground">User defined</span>
          </Label>
        </div>
      </RadioGroup>

      <div
        v-if="localSettings.pageRangeMode === 'custom'"
        class="pt-1 animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <Input
          v-model="localSettings.customPageRange"
          type="text"
          placeholder="e.g., 1-5, 8, 10-12"
          class="h-10 font-mono text-xs border-border/40 px-4 bg-muted/20"
          :class="
            pageRangeError
              ? 'border-destructive focus-visible:ring-destructive/20'
              : 'focus-visible:ring-primary/20'
          "
        />
        <p v-if="pageRangeError" class="text-xxs font-bold text-destructive mt-2 pl-1 uppercase">
          Error: {{ pageRangeError }}
        </p>
        <p v-else class="text-xxs font-medium text-muted-foreground/60 mt-2 pl-1 tracking-tight">
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
          class="w-full h-10 px-4 py-0 justify-between text-xxs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
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
              <p class="text-xxs text-muted-foreground font-medium">
                Internal PDF structure optimization
              </p>
            </div>
            <Checkbox
              id="opt-compress"
              :checked="localSettings.compress"
              @update:checked="(v: boolean) => (localSettings.compress = v)"
            />
          </div>

          <!-- Ghostscript Compression Quality -->
          <div class="p-4 bg-background/50 border border-border/20 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="text-sm font-semibold">PDF Compression (Ghostscript)</Label>
                <p class="text-xxs text-muted-foreground font-medium">
                  Reduce file size with image downsampling
                </p>
              </div>
            </div>
            <RadioGroup v-model="localSettings.compressionQuality" class="grid grid-cols-2 gap-2">
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
                  <span class="text-xxs text-muted-foreground">72 dpi · Max compression</span>
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
</template>
