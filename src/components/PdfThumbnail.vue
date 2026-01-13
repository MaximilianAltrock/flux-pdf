<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { RotateCw, Trash2, Scissors } from 'lucide-vue-next'
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
  sourceColor?: string
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  preview: []
  rotate: []
  delete: []
}>()

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

const containerRef = ref<HTMLElement | null>(null)

// State
const thumbnailUrl = ref<string | null>(null)
const isLoading = ref(false)
const hasError = ref(false)
const isVisible = ref(false)
const hasBeenVisible = ref(false)

const sourceColor = computed(() => props.sourceColor || 'gray')

const cssWidth = computed(() => (props.fixedSize ? `${props.width ?? 220}px` : '100%'))
const renderTargetWidth = computed(() => props.width ?? 300)

const { stop: stopObserver } = useIntersectionObserver(
  containerRef,
  ([entry]) => {
    isVisible.value = entry?.isIntersecting ?? false

    if (entry?.isIntersecting && !hasBeenVisible.value) {
      hasBeenVisible.value = true
      loadThumbnail()
    }
  },
  {
    rootMargin: '200px',
    threshold: 0,
  },
)

async function loadThumbnail() {
  if (thumbnailUrl.value || isLoading.value) return

  isLoading.value = true
  hasError.value = false

  try {
    const url = await renderThumbnail(props.pageRef, renderTargetWidth.value)
    thumbnailUrl.value = url
  } catch (error) {
    if ((error as Error).message !== 'Render aborted') {
      console.error('Thumbnail render error:', error)
      hasError.value = true
    }
  } finally {
    isLoading.value = false
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
      thumbnailUrl.value = null
      loadThumbnail()
    }
  },
)

onUnmounted(() => {
  stopObserver()
  cancelRender(props.pageRef.id)
})

function handleClick(event: MouseEvent) {
  emit('click', event)
}

function handleDoubleClick(event: MouseEvent) {
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
    class="flex flex-col items-center gap-2 p-2 cursor-pointer select-none relative group/thumbnail h-fit transition-colors duration-200 rounded-md"
    :class="{
      'w-full': !fixedSize,
      'bg-primary/5 ring-1 ring-primary/20': selected,
      'hover:bg-muted/30': !selected,
      'opacity-60': isRazorActive && !canSplit,
    }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Razor Cut Indicator -->
    <div
      v-if="isRazorActive && canSplit"
      class="absolute -left-[5px] top-0 bottom-0 w-[10px] flex flex-col items-center justify-between py-1 opacity-0 group-hover/thumbnail:opacity-100 group-hover/thumbnail:-translate-x-0.5 transition-all duration-300 z-50 pointer-events-none"
    >
      <div
        class="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]"
      ></div>
      <div class="flex-1 laser-line"></div>
      <div
        class="my-1.5 p-1 bg-destructive rounded-full shadow-xl border border-background scale-90 group-hover/thumbnail:scale-100 transition-transform duration-500 delay-100"
      >
        <Scissors class="w-3 h-3 text-destructive-foreground" />
      </div>
      <div class="flex-1 laser-line"></div>
      <div
        class="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]"
      ></div>
    </div>

    <!-- Thumbnail paper -->
    <div
      class="ide-card grid-stack !transition-all !duration-500"
      :class="{
        'ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent shadow-lg scale-[1.02]':
          selected,
        'w-full shadow-sm': !fixedSize,
      }"
      :style="{ width: cssWidth }"
    >
      <!-- Source Strip (Integrated onto the left edge of the paper) -->
      <div
        class="absolute left-0 top-0 bottom-0 w-1 z-10 opacity-70"
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
          <p class="text-xxs font-bold uppercase tracking-wider">Failed to render</p>
          <Button variant="link" size="sm" class="p-0 text-xxs h-6" @click.stop="handleRetry">
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
        class="w-full h-auto block select-none pl-1 transition-opacity duration-300"
        :class="{ 'opacity-100': thumbnailUrl, 'opacity-0': !thumbnailUrl }"
        loading="lazy"
      />

      <!-- Action Toolbar (Simplified for High-Fi) -->
      <div
        v-if="!isLoading && !hasError"
        class="absolute top-1.5 right-1.5 flex flex-col gap-1.5 opacity-0 group-hover/thumbnail:opacity-100 translate-x-2 group-hover/thumbnail:translate-x-0 transition-all duration-300 z-20"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="secondary"
              size="icon"
              class="h-7 w-7 bg-background shadow-md hover:bg-muted rounded-[4px] border border-border/10"
              @click.stop="emit('rotate')"
            >
              <RotateCw class="w-3.5 h-3.5 text-foreground/70" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Rotate 90°</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="destructive"
              size="icon"
              class="h-7 w-7 shadow-md rounded-[4px] border border-destructive/20"
              @click.stop="emit('delete')"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Remove Page</TooltipContent>
        </Tooltip>
      </div>
    </div>
    <!-- Page Identifier -->
    <div class="flex items-center gap-1.5 px-1 py-0.5 rounded-sm transition-colors duration-200">
      <span
        class="font-mono text-xxs font-bold text-muted-foreground group-hover/thumbnail:text-foreground"
      >
        {{ pageNumber.toString().padStart(2, '0') }}
      </span>
      <div v-if="selected" class="w-1 h-1 rounded-full bg-primary animate-pulse"></div>
    </div>
  </div>
</template>

<style scoped></style>
