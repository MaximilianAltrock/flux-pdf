<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { ROTATION_DEFAULT_DEGREES } from '@/constants'
import type { PageReference } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Check } from 'lucide-vue-next'

const props = defineProps<{
  sourceId: string
  pageIndex: number
  pageNumber: number
  width?: number
  sourceColor?: string
  selected?: boolean
}>()

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

const containerRef = ref<HTMLElement | null>(null)
const thumbnailUrl = ref<string | null>(null)
const isLoading = ref(false)
const hasError = ref(false)
const hasBeenVisible = ref(false)
const renderRequestId = ref(0)
const lastPageRefId = ref('')

const pageRefId = computed(() => `${props.sourceId}:${props.pageIndex}`)
const pageRef = computed<PageReference>(() => ({
  id: pageRefId.value,
  sourceFileId: props.sourceId,
  sourcePageIndex: props.pageIndex,
  rotation: ROTATION_DEFAULT_DEGREES,
}))

const sourceColor = computed(() => props.sourceColor || 'gray')
const renderTargetWidth = computed(() => props.width ?? 96)
const cssWidth = computed(() => (props.width ? `${props.width}px` : '100%'))
const { stop: stopObserver } = useIntersectionObserver(
  containerRef,
  ([entry]) => {
    if (entry?.isIntersecting && !hasBeenVisible.value) {
      hasBeenVisible.value = true
      loadThumbnail()
    }
  },
  { rootMargin: '200px', threshold: 0 },
)

async function loadThumbnail() {
  if (thumbnailUrl.value) return

  const requestId = ++renderRequestId.value
  const currentRef = pageRef.value
  lastPageRefId.value = currentRef.id
  cancelRender(currentRef.id)
  isLoading.value = true
  hasError.value = false

  try {
    const url = await renderThumbnail(currentRef, renderTargetWidth.value)
    if (requestId !== renderRequestId.value) return
    thumbnailUrl.value = url
  } catch (error) {
    if (requestId !== renderRequestId.value) return
    if ((error as Error).message !== 'Render aborted') {
      hasError.value = true
    }
  } finally {
    if (requestId === renderRequestId.value) {
      isLoading.value = false
    }
  }
}

watch([() => props.sourceId, () => props.pageIndex], () => {
  if (hasBeenVisible.value) {
    if (lastPageRefId.value) cancelRender(lastPageRefId.value)
    thumbnailUrl.value = null
    loadThumbnail()
  }
})

onUnmounted(() => {
  stopObserver()
  cancelRender(pageRefId.value)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full rounded-sm overflow-hidden ui-panel-muted border border-border/60 bg-muted/10 transition-all duration-200"
    :class="
      selected
        ? 'ring-2 ring-primary/80 ring-offset-2 ring-offset-background border-primary/60 bg-primary/15 shadow-[0_0_0_1px_rgba(8,145,178,0.35)]'
        : 'hover:border-primary/40 hover:shadow-sm'
    "
    :style="{ width: cssWidth }"
  >
    <div
      class="absolute inset-y-0 left-0 w-1 z-10 opacity-90 pointer-events-none"
      :style="{ backgroundColor: sourceColor }"
    ></div>

    <div
      v-if="!hasBeenVisible"
      class="aspect-[8.5/11] bg-muted/20 flex items-center justify-center animate-pulse"
    ></div>

    <Skeleton
      v-else-if="isLoading && !thumbnailUrl"
      class="aspect-[8.5/11] w-full rounded-none opacity-60"
    />

    <div
      v-else-if="hasError"
      class="aspect-[8.5/11] bg-destructive/5 flex flex-col items-center justify-center text-destructive/80"
    >
      <AlertTriangle class="w-4 h-4" />
    </div>

    <img
      v-else-if="thumbnailUrl"
      :src="thumbnailUrl"
      :alt="`Page ${pageNumber}`"
      class="w-full h-auto block select-none"
      draggable="false"
      loading="lazy"
    />

    <div
      class="absolute top-1 right-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-card/85 text-foreground border border-border/70 shadow-sm"
    >
      {{ pageNumber }}
    </div>

    <div
      v-if="selected"
      class="absolute top-1 left-1 rounded-sm px-1 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground shadow-sm"
      aria-hidden="true"
    >
      <Check class="w-3 h-3" />
    </div>
  </div>
</template>
