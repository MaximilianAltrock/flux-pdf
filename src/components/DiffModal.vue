<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, ZoomIn, ZoomOut, Eye, Layers, Zap, Columns } from 'lucide-vue-next'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import type { PageReference } from '@/types'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  open: boolean
  pages: [PageReference, PageReference] | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { renderThumbnail } = useThumbnailRenderer()

const dialogRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

// State
const urlA = ref<string | null>(null)
const urlB = ref<string | null>(null)
const isLoading = ref(true)

// View Controls
const zoom = ref(1)
const opacity = ref(100) // 0-100
const blendMode = ref<'difference' | 'normal'>('difference')
const viewMode = ref<'overlay' | 'side-by-side'>('overlay') // New State
const isBlinking = ref(false)
let blinkInterval: number | null = null

// Load Images High-Res
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen && props.pages) {
      isLoading.value = true
      zoom.value = 1
      opacity.value = 100
      blendMode.value = 'difference'
      viewMode.value = 'overlay'
      stopBlink()

      try {
        const [pageA, pageB] = props.pages
        const [a, b] = await Promise.all([
          renderThumbnail(pageA, 800, 3),
          renderThumbnail(pageB, 800, 3),
        ])
        urlA.value = a
        urlB.value = b
      } catch (e) {
        console.error(e)
      } finally {
        isLoading.value = false
      }
    }

    if (!isOpen) {
      stopBlink()
    }
  },
)

// --- Actions ---

function setOverlayMode() {
  viewMode.value = 'overlay'
  blendMode.value = 'difference'
  opacity.value = 100
  stopBlink()
}

function setSideBySideMode() {
  viewMode.value = 'side-by-side'
  blendMode.value = 'normal'
  opacity.value = 100
  stopBlink()
  // Adjust zoom slightly if it's too huge for side-by-side
  if (zoom.value > 1.5) zoom.value = 1
}

function toggleBlink() {
  if (isBlinking.value) {
    stopBlink()
  } else {
    // Switch to overlay/normal for standard blink comparison behavior
    viewMode.value = 'overlay'
    blendMode.value = 'normal'
    isBlinking.value = true

    // Start with showing B
    opacity.value = 100

    blinkInterval = window.setInterval(() => {
      // Toggle between seeing A (0%) and seeing B (100%)
      opacity.value = opacity.value === 100 ? 0 : 100
    }, 400) // 400ms is a standard interval for visual comparison
  }
}

function stopBlink() {
  isBlinking.value = false
  if (blinkInterval) {
    clearInterval(blinkInterval)
    blinkInterval = null
  }

  // Reset opacity to fully visible
  opacity.value = 100

  // FIX: If we are in Overlay mode, revert to 'difference' (The Black/Ghost View)
  // This restores the X-Ray effect immediately after blinking stops.
  if (viewMode.value === 'overlay') {
    blendMode.value = 'difference'
  }
}

function handleZoom(delta: number) {
  zoom.value = Math.max(0.25, Math.min(4, zoom.value + delta))
}

useFocusTrap(
  computed(() => props.open),
  dialogRef,
  {
    onEscape: () => emit('close'),
    initialFocus: () => closeButtonRef.value,
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && pages"
        ref="dialogRef"
        class="fixed inset-0 z-[100] bg-background/95 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-dialog-title"
      >
        <!-- Header -->
        <header
          class="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/50 backdrop-blur shrink-0"
        >
          <div class="flex items-center gap-4">
            <h2 id="diff-dialog-title" class="text-text font-semibold flex items-center gap-2">
              <Layers class="w-5 h-5 text-primary" />
              Ghost Overlay
            </h2>
            <div class="h-4 w-px bg-border"></div>
            <div class="text-xs text-text-muted flex items-center gap-2 font-mono">
              <span class="text-primary font-bold">A</span>
              <span>Page {{ pages[0].sourcePageIndex + 1 }}</span>
              <span class="text-text-muted/50">vs</span>
              <span class="text-danger font-bold">B</span>
              <span>Page {{ pages[1].sourcePageIndex + 1 }}</span>
            </div>
          </div>

          <button
            @click="emit('close')"
            class="p-2 hover:bg-muted/10 rounded-lg text-text-muted hover:text-text transition-colors"
            type="button"
            aria-label="Close diff view"
            ref="closeButtonRef"
          >
            <X class="w-5 h-5" />
          </button>
        </header>

        <!-- Canvas -->
        <div class="flex-1 overflow-hidden relative flex items-center justify-center bg-dots p-8">
          <div v-if="isLoading" class="flex flex-col items-center gap-3">
            <svg class="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
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
            <span class="text-xs text-text-muted font-mono uppercase tracking-widest"
              >Rendering...</span
            >
          </div>

          <!-- IMAGE CONTAINER -->
          <div
            v-else
            class="transition-all duration-300 ease-out origin-center"
            :class="
              viewMode === 'side-by-side'
                ? 'flex gap-8 items-start'
                : 'relative shadow-2xl border border-border'
            "
            :style="{ transform: `scale(${zoom})` }"
          >
            <!-- Page A (Base) -->
            <div
              class="relative bg-white shadow-sm"
              :class="{ 'ring-2 ring-primary/50': viewMode === 'side-by-side' }"
            >
              <img :src="urlA!" class="block max-h-[65vh] w-auto select-none" />
              <div
                v-if="viewMode === 'side-by-side'"
                class="absolute -top-6 left-0 text-xs font-bold text-primary"
              >
                A
              </div>
            </div>

            <!-- Page B (Overlay) -->
            <!--
                 FIX: Removed 'bg-white' from the static classes.
                 Added 'bg-white' ONLY if side-by-side.
                 Added 'bg-transparent' and 'pointer-events-none' if overlay.
            -->
            <div
              class="shadow-sm transition-all duration-300"
              :class="
                viewMode === 'side-by-side'
                  ? 'relative ring-2 ring-danger/50 bg-white'
                  : 'absolute inset-0 w-full h-full bg-transparent pointer-events-none'
              "
            >
              <img
                :src="urlB!"
                class="block w-full h-full select-none"
                :class="viewMode === 'side-by-side' ? 'max-h-[65vh] w-auto' : ''"
                :style="{
                  mixBlendMode: viewMode === 'side-by-side' ? 'normal' : blendMode,
                  opacity: viewMode === 'side-by-side' ? 1 : opacity / 100,
                }"
              />
              <div
                v-if="viewMode === 'side-by-side'"
                class="absolute -top-6 left-0 text-xs font-bold text-danger"
              >
                B
              </div>
            </div>
          </div>

          <!-- Floating Controls -->
          <div
            class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-xl shadow-xl p-2 flex items-center gap-4 z-50"
          >
            <!-- Mode Toggle -->
            <div class="flex items-center gap-1 bg-background rounded-lg p-1 border border-border">
              <button
                @click="setOverlayMode"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2"
                :class="
                  viewMode === 'overlay'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                "
              >
                <Layers class="w-3.5 h-3.5" /> Overlay
              </button>
              <button
                @click="setSideBySideMode"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2"
                :class="
                  viewMode === 'side-by-side'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                "
              >
                <Columns class="w-3.5 h-3.5" /> Side-by-Side
              </button>
            </div>

            <div class="w-px h-8 bg-border"></div>

            <!-- Opacity Slider -->
            <div
              class="flex items-center gap-3 px-2"
              :class="{ 'opacity-30 pointer-events-none': viewMode === 'side-by-side' }"
            >
              <Eye class="w-4 h-4 text-text-muted" />
              <input
                type="range"
                v-model="opacity"
                min="0"
                max="100"
                :disabled="isBlinking || viewMode === 'side-by-side'"
                class="w-32 accent-primary cursor-pointer"
              />
              <span class="text-xs font-mono text-text w-8 text-right">{{ opacity }}%</span>
            </div>

            <div class="w-px h-8 bg-border"></div>

            <!-- Blink Mode -->
            <button
              @click="toggleBlink"
              class="p-2 rounded-lg transition-colors flex flex-col items-center gap-0.5"
              :class="
                isBlinking
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'text-text-muted hover:bg-muted/10 hover:text-text'
              "
              title="Blink Mode"
            >
              <Zap class="w-4 h-4" :class="{ 'fill-current': isBlinking }" />
            </button>

            <div class="w-px h-8 bg-border"></div>

            <!-- Zoom -->
            <div class="flex items-center gap-1">
              <button
                @click="handleZoom(-0.25)"
                class="p-2 text-text-muted hover:text-text rounded-lg hover:bg-muted/10"
              >
                <ZoomOut class="w-4 h-4" />
              </button>
              <button
                @click="handleZoom(0.25)"
                class="p-2 text-text-muted hover:text-text rounded-lg hover:bg-muted/10"
              >
                <ZoomIn class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.modal-leave-to {
  opacity: 0;
}

.bg-dots {
  background-color: rgb(var(--background));
  background-image: radial-gradient(rgb(var(--border)) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
