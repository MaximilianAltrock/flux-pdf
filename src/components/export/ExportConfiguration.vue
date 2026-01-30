<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
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
import { useVModel } from '@vueuse/core'

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
const pageRangeError = shallowRef<string | null>(null)
const showAdvanced = shallowRef(false)

// Local proxy for settings to avoid deep mutation issues

const localSettings = useVModel(props, 'settings', emit, {
  passive: true,
  deep: true,
  clone: true,
})

watch(
  [localSettings, () => document.selectedCount, () => document.contentPageCount],
  () => {
    validateForm()
  },
  { deep: true, immediate: true },
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

const estimatedSize = computed(() => getEstimatedSize(pagesToExport.value))

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

</script>

<template>
  <div class="space-y-6">
    <!-- File info summary -->
    <div class="ui-panel rounded-md p-4 flex items-center gap-4">
      <div
        class="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0"
      >
        <FileText class="w-5 h-5 text-primary" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-0.5">
          <span class="ui-kicker">Export summary</span>
          <span
            class="ui-mono ui-2xs font-semibold text-primary px-1.5 py-0.5 bg-primary/10 border border-primary/30 rounded-sm"
            >{{ pageCount }} PAGES</span
          >
        </div>
        <p class="text-sm font-semibold text-foreground truncate">
          {{ pageRangeDescription }}
        </p>
        <p class="ui-caption ui-mono">
          Estimated size:
          <span class="text-foreground/80">{{ formatBytes(estimatedSize) }}</span>
          <span class="ml-1 text-xs opacity-50">({{ estimatedSize }} B)</span>
        </p>
      </div>
    </div>

    <!-- Filename -->
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <Label for="filename" class="ui-kicker">
          File name
        </Label>
      </div>
      <InputGroup class="rounded-sm">
        <InputGroupInput
          id="filename"
          ref="filenameInputRef"
          v-model="localSettings.filename"
          type="text"
          placeholder="untitled-project"
          class="ui-mono text-sm"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText class="ui-mono ui-2xs opacity-60">.pdf</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <!-- Page Range -->
    <div class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <Label class="ui-kicker">Page range</Label>
      </div>

      <RadioGroup v-model="localSettings.pageRangeMode" class="grid grid-cols-1 gap-2">
        <div class="relative">
          <RadioGroupItem id="range-all" value="all" class="peer sr-only" />
          <Label
            for="range-all"
            class="flex items-center justify-between px-3 h-10 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
          >
            <span class="ui-label">All pages</span>
            <span class="ui-mono ui-2xs text-muted-foreground"
              >{{ document.pageCount }} pages</span>
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
            class="flex items-center justify-between px-3 h-10 rounded-sm border border-border transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
            :class="
              document.selectedCount > 0
                ? 'cursor-pointer hover:bg-muted/20'
                : 'opacity-50 cursor-not-allowed bg-muted/10'
            "
          >
            <span class="ui-label">Selected pages</span>
            <span class="ui-mono ui-2xs text-muted-foreground"
              >{{ document.selectedCount }} items</span>
          </Label>
        </div>

        <div class="relative">
          <RadioGroupItem id="range-custom" value="custom" class="peer sr-only" />
          <Label
            for="range-custom"
            class="flex items-center justify-between px-3 h-10 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
          >
            <span class="ui-label">Custom range</span>
            <span class="ui-mono ui-2xs text-muted-foreground">Custom</span>
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
          class="h-9 ui-mono text-xs px-3"
          :class="
            pageRangeError
              ? 'border-destructive focus-visible:ring-destructive/20'
              : ''
          "
        />
        <p v-if="pageRangeError" class="ui-caption text-destructive mt-2 pl-1">
          {{ pageRangeError }}
        </p>
        <p v-else class="ui-caption text-muted-foreground/70 mt-2 pl-1">
          Enter comma-separated page numbers or ranges (e.g. 1-4, 7, 12).
        </p>
      </div>
    </div>

    <!-- Advanced Options Toggle -->
    <Collapsible
      v-model:open="showAdvanced"
      class="ui-panel-muted rounded-md overflow-hidden"
    >
      <CollapsibleTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          class="w-full h-9 px-4 py-0 justify-between ui-kicker text-muted-foreground hover:text-foreground transition-colors"
        >
          <div class="flex items-center gap-2">
            <Settings class="w-3 h-3" />
            Advanced options
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
            class="ui-panel rounded-md p-4 flex items-center justify-between"
          >
            <div class="space-y-0.5">
              <Label for="opt-compress" class="ui-label cursor-pointer">
                Object stream compression
              </Label>
              <p class="ui-caption">
                Optimize PDF structure (no visual changes)
              </p>
            </div>
            <Checkbox id="opt-compress" v-model="localSettings.compress" />
          </div>

          <!-- Ghostscript Compression Quality -->
          <div class="ui-panel rounded-md p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="ui-label">PDF compression (Ghostscript)</Label>
                <p class="ui-caption">
                  Reduce file size by downsampling images.
                </p>
              </div>
            </div>
            <RadioGroup v-model="localSettings.compressionQuality" class="grid grid-cols-2 gap-2">
              <div class="relative">
                <RadioGroupItem id="cq-none" value="none" class="peer sr-only" />
                <Label
                  for="cq-none"
                  class="flex flex-col px-3 py-2 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
                >
                  <span class="ui-label">None</span>
                  <span class="ui-caption">No compression</span>
                </Label>
              </div>
              <div class="relative">
                <RadioGroupItem id="cq-screen" value="screen" class="peer sr-only" />
                <Label
                  for="cq-screen"
                  class="flex flex-col px-3 py-2 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
                >
                  <span class="ui-label">Screen</span>
                  <span class="ui-caption">72 dpi - Highest compression</span>
                </Label>
              </div>
              <div class="relative">
                <RadioGroupItem id="cq-ebook" value="ebook" class="peer sr-only" />
                <Label
                  for="cq-ebook"
                  class="flex flex-col px-3 py-2 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
                >
                  <span class="ui-label">Ebook</span>
                  <span class="ui-caption">150 dpi - Balanced</span>
                </Label>
              </div>
              <div class="relative">
                <RadioGroupItem id="cq-printer" value="printer" class="peer sr-only" />
                <Label
                  for="cq-printer"
                  class="flex flex-col px-3 py-2 rounded-sm border border-border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/20"
                >
                  <span class="ui-label">Printer</span>
                  <span class="ui-caption">300 dpi - High quality</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
