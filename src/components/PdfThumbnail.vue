<script setup lang="ts">
import { shallowRef, watch, onUnmounted, computed, useTemplateRef } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { RotateCw, Trash2, Scissors, AlertTriangle } from 'lucide-vue-next'
import type { PageReference } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  pageRef: PageReference
  pageNumber: number
  selected?: boolean
  width?: number
  fixedSize?: boolean
  isStartOfFile?: boolean
  isRazorActive?: boolean
  canSplit?: boolean
  actionsDisabled?: boolean
  hoverDisabled?: boolean
  sourceColor?: string
  problemSeverity?: 'error' | 'warning' | 'info'
  problemMessages?: string[]
}>()

const emit = defineEmits<{
  click: [event: MouseEvent | KeyboardEvent]
  preview: []
  rotate: []
  delete: []
  visible: [pageId: string, ratio: number]
}>()

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

const containerRef = useTemplateRef<HTMLElement>('containerRef')
const lastPageRefId = shallowRef(props.pageRef.id)

// State
const thumbnailUrl = shallowRef<string | null>(null)
const isLoading = shallowRef(false)
const hasError = shallowRef(false)
const hasBeenVisible = shallowRef(false)
const renderRequestId = shallowRef(0)

const sourceColor = computed(() => props.sourceColor || 'gray')
const problemCount = computed(() => props.problemMessages?.length ?? 0)
const hoverEnabled = computed(() => !props.hoverDisabled)

const problemClass = computed(() => {
  if (props.problemSeverity === 'error') return 'bg-destructive/15 text-destructive'
  if (props.problemSeverity === 'warning') return 'bg-amber-500/15 text-amber-600'
  return 'bg-muted text-muted-foreground'
})

const cssWidth = computed(() => (props.fixedSize ? `${props.width ?? 220}px` : '100%'))
const renderTargetWidth = computed(() => props.width ?? 300)

const { stop: stopObserver } = useIntersectionObserver(
  containerRef,
  ([entry]) => {
    if (entry?.isIntersecting && !hasBeenVisible.value) {
      hasBeenVisible.value = true
      loadThumbnail()
    }
    if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) {
      emit('visible', props.pageRef.id, entry.intersectionRatio)
    }
  },
  {
    rootMargin: '200px',
    threshold: [0, 0.6],
  },
)

async function loadThumbnail() {
  if (thumbnailUrl.value) return

  const requestId = ++renderRequestId.value
  const pageRef = props.pageRef
  lastPageRefId.value = pageRef.id
  cancelRender(pageRef.id)
  isLoading.value = true
  hasError.value = false

  try {
    const url = await renderThumbnail(pageRef, renderTargetWidth.value)
    if (requestId !== renderRequestId.value) return
    thumbnailUrl.value = url
  } catch (error) {
    if (requestId !== renderRequestId.value) return
    if ((error as Error).message !== 'Render aborted') {
      console.error('Thumbnail render error:', error)
      hasError.value = true
    }
  } finally {
    if (requestId === renderRequestId.value) {
      isLoading.value = false
    }
  }
}

watch(
  [
    () => props.pageRef.sourceFileId,
    () => props.pageRef.sourcePageIndex,
    () => props.pageRef.rotation,
  ],
  () => {
    if (hasBeenVisible.value) {
      cancelRender(lastPageRefId.value)
      lastPageRefId.value = props.pageRef.id
      thumbnailUrl.value = null
      loadThumbnail()
    }
  },
)

onUnmounted(() => {
  stopObserver()
  cancelRender(props.pageRef.id)
})

function handleClick(event: MouseEvent | KeyboardEvent) {
  emit('click', event)
}

function handleDoubleClick(event: Event) {
  event.stopPropagation()
  emit('preview')
}

function handleRetry() {
  hasError.value = false
  loadThumbnail()
}
</script>

<template>
  <div
    ref="containerRef"
    :data-page-id="pageRef.id"
    class="flex flex-col items-center gap-2 p-2 cursor-pointer select-none relative h-fit transition-colors duration-200 rounded-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    :class="{
      'w-full': !fixedSize,
      'bg-primary/5 ring-1 ring-primary/20': selected,
      'hover:bg-muted/20': !selected && hoverEnabled,
      'opacity-60': isRazorActive && !canSplit,
      'group/thumbnail': hoverEnabled,
    }"
    role="button"
    tabindex="0"
    :aria-label="`Page ${pageNumber}`"
    :aria-pressed="selected ? 'true' : 'false'"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @keydown.enter.prevent="handleDoubleClick"
    @keydown.space.prevent="handleClick"
  >
    <!-- Thumbnail paper -->
    <div class="relative" :style="{ width: cssWidth }">
      <div
        class="grid-stack relative overflow-hidden ui-panel rounded-sm !transition-all !duration-500 w-full"
        :class="{
          'ring-1 ring-primary/40 ring-offset-1 ring-offset-background': selected,
          'w-full': !fixedSize,
        }"
      >
        <Tooltip v-if="problemCount > 0">
          <TooltipTrigger as-child>
            <div
              class="absolute top-2 left-2 z-20 rounded-sm px-1.5 py-1 text-[10px] font-semibold flex items-center gap-1 shadow-sm border border-border/60"
              :class="problemClass"
            >
              <AlertTriangle class="w-3 h-3" />
              <span>{{ problemCount }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" class="max-w-[240px] text-xs leading-snug">
            <div class="space-y-1">
              <p v-for="msg in props.problemMessages" :key="msg">{{ msg }}</p>
            </div>
          </TooltipContent>
        </Tooltip>

        <!-- Source Strip (Integrated onto the left edge of the paper) -->
        <div
          class="absolute inset-y-0 left-0 w-1.5 z-10 opacity-90 pointer-events-none"
          :style="{ backgroundColor: sourceColor }"
        ></div>

        <!-- Placeholder -->
        <div
          v-if="!hasBeenVisible"
          class="aspect-[8.5/11] bg-muted/20 flex items-center justify-center animate-pulse"
        ></div>

        <!-- Skeleton -->
        <Skeleton
          v-else-if="isLoading && !thumbnailUrl"
          class="aspect-[8.5/11] w-full rounded-none opacity-50"
        />

        <!-- Error state -->
        <div
          v-else-if="hasError"
          class="aspect-[8.5/11] bg-destructive/5 flex flex-col items-center justify-center gap-3 text-destructive p-4 text-center ring-inset ring-1 ring-destructive/10"
        >
          <div class="p-2 bg-destructive/10 rounded-full">
            <Trash2 class="w-5 h-5" />
          </div>
          <div class="space-y-1">
            <p class="ui-kicker text-destructive">Failed to render</p>
            <Button variant="link" size="sm" class="p-0 text-xs h-6" @click.stop="handleRetry">
              Try again
            </Button>
          </div>
        </div>

        <!-- Rendered image -->
        <img
          v-else-if="thumbnailUrl"
          :src="thumbnailUrl"
          draggable="false"
          :alt="`Page ${pageNumber}`"
          class="w-full h-auto block select-none transition-opacity duration-300"
          :class="{ 'opacity-100': thumbnailUrl, 'opacity-0': !thumbnailUrl }"
          loading="lazy"
        />

        <!-- Action Toolbar (Simplified for High-Fi) -->
      <div
        v-if="!isLoading && !hasError && !isRazorActive && !actionsDisabled"
        class="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-card/85 backdrop-blur-sm border border-border/70 p-1 shadow-sm opacity-0 group-hover/thumbnail:opacity-100 group-focus-within/thumbnail:opacity-100 translate-y-1 group-hover/thumbnail:translate-y-0 transition-all duration-300 z-20"
      >
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/60"
                @click.stop="emit('rotate')"
                aria-label="Rotate page 90 degrees"
              >
                <RotateCw class="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Rotate 90deg</TooltipContent>
          </Tooltip>

          <div class="w-px h-4 bg-border/60"></div>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="h-6 w-6 rounded-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                @click.stop="emit('delete')"
                aria-label="Remove page"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Remove Page</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- Razor Cut Indicator -->
      <div
        v-if="isRazorActive && canSplit"
        class="absolute inset-y-2 left-0 -translate-x-full -ml-2 z-30 pointer-events-none opacity-0 transition-opacity duration-200 group-hover/thumbnail:opacity-100"
      >
        <div class="h-full flex flex-col items-center gap-2">
          <div class="flex-1 w-px border-l border-dashed border-destructive/40"></div>
          <div
            class="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-destructive/10 border border-destructive/30 shadow-sm"
          >
            <Scissors class="w-3 h-3 text-destructive" />
            <span class="ui-mono ui-2xs tracking-[0.24em] uppercase text-destructive/90"
              >Cut</span
            >
          </div>
          <div class="flex-1 w-px border-l border-dashed border-destructive/40"></div>
        </div>
      </div>
    </div>
    <!-- Page Identifier -->
    <div class="flex items-center gap-1.5 px-1 py-0.5 rounded-sm transition-colors duration-200">
      <span
        class="ui-mono text-xs font-semibold text-muted-foreground group-hover/thumbnail:text-foreground"
      >
        {{ pageNumber.toString().padStart(2, '0') }}
      </span>
      <div v-if="selected" class="w-1 h-1 rounded-full bg-primary"></div>
    </div>
  </div>
</template>

<style scoped></style>
