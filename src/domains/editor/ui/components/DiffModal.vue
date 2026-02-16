<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { X, ZoomIn, ZoomOut, Eye, Layers, Zap, Columns } from 'lucide-vue-next'
import { useThumbnailRenderer } from '@/domains/document/application/useThumbnailRenderer'
import type { PageReference } from '@/shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/shared/components/ui/dialog'
import { Slider } from '@/shared/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Spinner } from '@/shared/components/ui/spinner'

const props = defineProps<{
  open: boolean
  pages: [PageReference, PageReference] | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { renderThumbnail } = useThumbnailRenderer()

// State
const urlA = shallowRef<string | null>(null)
const urlB = shallowRef<string | null>(null)
const isLoading = shallowRef(true)

// View Controls
const zoom = shallowRef(1)
const opacity = ref([100]) // Shadcn Slider uses array for multi-thumb
const blendMode = shallowRef<'difference' | 'normal'>('difference')
const viewMode = shallowRef('overlay')
const isBlinking = shallowRef(false)
const { pause: stopBlinkTimer, resume: startBlinkTimer } = useIntervalFn(
  () => {
    opacity.value = opacity.value[0] === 100 ? [0] : [100]
  },
  400,
  { immediate: false },
)

// Load Images High-Res
watch(
  () => [
    props.open,
    props.pages?.[0]?.id,
    props.pages?.[0]?.rotation,
    props.pages?.[1]?.id,
    props.pages?.[1]?.rotation,
  ],
  async ([isOpen], _prev, onInvalidate) => {
    let canceled = false
    onInvalidate(() => {
      canceled = true
    })

    if (isOpen && props.pages) {
      isLoading.value = true
      zoom.value = 1
      opacity.value = [100]
      blendMode.value = 'difference'
      viewMode.value = 'overlay'
      stopBlink()

      try {
        const [pageA, pageB] = props.pages
        const [a, b] = await Promise.all([
          renderThumbnail(pageA, 800, 3),
          renderThumbnail(pageB, 800, 3),
        ])
        if (!canceled) {
          urlA.value = a
          urlB.value = b
        }
      } catch (e) {
        if (!canceled) {
          console.error(e)
        }
      } finally {
        if (!canceled) {
          isLoading.value = false
        }
      }
    }

    if (!isOpen) {
      stopBlink()
    }
  },
)

// --- Actions ---

function handleViewModeChange(val: string) {
  if (!val) return
  viewMode.value = val
  if (val === 'side-by-side') {
    blendMode.value = 'normal'
    opacity.value = [100]
    stopBlink()
    if (zoom.value > 1.5) zoom.value = 1
  } else {
    blendMode.value = 'difference'
    opacity.value = [100]
    stopBlink()
  }
}

function toggleBlink() {
  if (isBlinking.value) {
    stopBlink()
  } else {
    viewMode.value = 'overlay'
    blendMode.value = 'normal'
    isBlinking.value = true
    opacity.value = [100]
    startBlinkTimer()
  }
}

function stopBlink() {
  isBlinking.value = false
  stopBlinkTimer()
  opacity.value = [100]
  if (viewMode.value === 'overlay') {
    blendMode.value = 'difference'
  }
}

function handleZoom(delta: number) {
  zoom.value = Math.max(0.25, Math.min(4, zoom.value + delta))
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent
      :show-close-button="false"
      class="max-w-none w-screen h-screen p-0 m-0 border-none flex flex-col gap-0 select-none overflow-hidden outline-none sm:max-w-none rounded-none bg-background"
    >
      <!-- Header -->
      <DialogHeader
        class="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 space-y-0 flex-row z-50"
      >
        <div class="flex items-center gap-6">
          <div class="flex flex-col">
            <span class="ui-kicker opacity-70 leading-none mb-1">Comparison</span>
            <DialogTitle class="text-sm font-semibold flex items-center gap-2">
              <Layers class="w-4 h-4 text-primary" />
              Compare pages
            </DialogTitle>
            <DialogDescription class="sr-only">
              Compare two pages using overlay or side-by-side views.
            </DialogDescription>
          </div>

          <div class="h-8 w-px bg-border/40 mx-2"></div>

          <div v-if="props.pages" class="flex items-center gap-3">
            <div
              class="flex items-center gap-2 px-2.5 py-1 bg-primary/10 rounded-md border border-primary/20"
            >
              <span class="text-xs font-black text-primary">A</span>
              <span class="text-xs font-mono font-medium text-primary/80"
                >Page {{ (props.pages[0].sourcePageIndex + 1).toString().padStart(2, '0') }}</span
              >
            </div>
            <span class="text-xs font-bold text-muted-foreground/40 italic">VS</span>
            <div
              class="flex items-center gap-2 px-2.5 py-1 bg-destructive/10 rounded-md border border-destructive/20"
            >
              <span class="text-xs font-black text-destructive">B</span>
              <span class="text-xs font-mono font-medium text-destructive/80"
                >Page {{ (props.pages[1].sourcePageIndex + 1).toString().padStart(2, '0') }}</span
              >
            </div>
          </div>
        </div>

        <DialogClose as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:rotate-90"
          >
            <X class="w-5 h-5" />
          </Button>
        </DialogClose>
      </DialogHeader>

      <!-- Canvas -->
      <div class="flex-1 overflow-hidden relative flex items-center justify-center bg-dots p-8">
        <div v-if="isLoading" class="flex flex-col items-center gap-3">
          <Spinner class="w-8 h-8 text-primary" />
          <span class="ui-kicker ui-mono opacity-70">Loading preview...</span>
        </div>

        <!-- IMAGE CONTAINER -->
        <template v-else-if="props.pages">
          <div
            class="transition-all duration-300 ease-out origin-center"
            :class="
              viewMode === 'side-by-side'
                ? 'flex gap-12 items-start'
                : 'relative shadow-lg border border-border/40'
            "
            :style="{ transform: `scale(${zoom})` }"
          >
            <!-- Page A (Base) -->
            <div
              class="relative bg-card shadow-lg rounded-sm overflow-hidden"
              :class="{
                'ring-4 ring-primary/20 border border-primary/40': viewMode === 'side-by-side',
              }"
            >
              <img :src="urlA!" class="block max-h-[70vh] w-auto select-none" />
              <div
                v-if="viewMode === 'side-by-side'"
                class="absolute top-3 left-3 flex items-center justify-center w-6 h-6 rounded bg-primary text-xs font-black text-primary-foreground"
              >
                A
              </div>
            </div>

            <!-- Page B (Overlay) -->
            <div
              class="shadow-lg transition-all duration-300 rounded-sm overflow-hidden"
              :class="
                viewMode === 'side-by-side'
                  ? 'relative ring-4 ring-destructive/20 border border-destructive/40 bg-card'
                  : 'absolute inset-0 w-full h-full bg-transparent pointer-events-none'
              "
            >
              <img
                v-if="urlB"
                :src="urlB"
                class="block w-full h-full select-none"
                :class="viewMode === 'side-by-side' ? 'max-h-[70vh] w-auto' : ''"
                :style="{
                  mixBlendMode: viewMode === 'side-by-side' ? 'normal' : blendMode,
                  opacity: viewMode === 'side-by-side' ? 1 : (opacity[0] ?? 100) / 100,
                }"
              />
              <div
                v-if="viewMode === 'side-by-side'"
                class="absolute top-3 left-3 flex items-center justify-center w-6 h-6 rounded bg-destructive text-xs font-black text-destructive-foreground"
              >
                B
              </div>
            </div>
          </div>
        </template>

        <!-- Floating Controls -->
        <div class="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none z-50">
          <div
            class="ui-panel pointer-events-auto rounded-md px-4 py-2 flex items-center gap-6 transition-colors"
          >
            <!-- Mode Toggle -->
            <div class="flex flex-col gap-1.5 px-1 font-sans">
              <span class="ui-kicker opacity-70 pl-1">View mode</span>
              <ToggleGroup
                type="single"
                :model-value="viewMode"
                @update:model-value="(val) => handleViewModeChange(val as string)"
                variant="outline"
                class="ui-panel-muted p-1 gap-1 rounded-sm"
              >
                <ToggleGroupItem
                  value="overlay"
                  class="px-3 py-1.5 h-8 gap-2 rounded-sm ui-label"
                >
                  <Layers class="w-3.5 h-3.5" /> Overlay
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="side-by-side"
                  class="px-3 py-1.5 h-8 gap-2 rounded-sm ui-label"
                >
                  <Columns class="w-3.5 h-3.5" /> Side by side
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator orientation="vertical" class="h-10 bg-border/40" />

            <!-- Opacity Slider -->
            <div
              class="flex flex-col gap-1.5 px-1 min-w-[180px]"
              :class="{ 'opacity-30 pointer-events-none': viewMode === 'side-by-side' }"
            >
              <div class="flex items-center justify-between px-1">
                <span class="ui-kicker opacity-70">Overlay opacity</span>
                <span class="ui-mono text-xs font-semibold text-primary">{{ opacity[0] }}%</span>
              </div>
              <div class="flex items-center gap-3">
                <Eye class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Slider
                  v-model="opacity"
                  :max="100"
                  :step="1"
                  :disabled="isBlinking || viewMode === 'side-by-side'"
                  class="w-32"
                />
              </div>
            </div>

            <Separator orientation="vertical" class="h-10 bg-border/40" />

            <!-- Tools (Blink & Zoom) -->
            <div class="flex items-center gap-3">
              <!-- Blink Mode -->
              <div class="flex flex-col items-center gap-1">
                <span class="ui-kicker opacity-50">Blink mode</span>
                <Button
                  @click="toggleBlink"
                  variant="ghost"
                  size="icon"
                  class="h-9 w-9 rounded-md transition-colors"
                  :class="
                    isBlinking
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  "
                  title="Toggle blink mode"
                >
                  <Zap class="w-4 h-4" :class="{ 'fill-current': isBlinking }" />
                </Button>
              </div>

              <!-- Zoom -->
              <div class="flex flex-col items-center gap-1">
                <span class="ui-kicker opacity-50">Zoom</span>
                <div class="ui-panel-muted flex items-center rounded-md p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    @click="handleZoom(-0.25)"
                    class="h-8 w-8 text-muted-foreground hover:text-foreground rounded-sm"
                  >
                    <ZoomOut class="w-4 h-4" />
                  </Button>
                  <div class="w-px h-4 bg-border/20 mx-0.5"></div>
                  <Button
                    variant="ghost"
                    size="icon"
                    @click="handleZoom(0.25)"
                    class="h-8 w-8 text-muted-foreground hover:text-foreground rounded-sm"
                  >
                    <ZoomIn class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.bg-dots {
  background-color: transparent;
  background-image: radial-gradient(
    color-mix(in oklch, var(--border), transparent 60%) 1px,
    transparent 1px
  );
  background-size: 20px 20px;
}
</style>
