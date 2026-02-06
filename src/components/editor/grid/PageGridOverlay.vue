<script setup lang="ts">
import { UploadCloud } from 'lucide-vue-next'

defineProps<{
  visible: boolean
}>()
</script>

<template>
  <Transition name="fade-backdrop">
    <div
      v-if="visible"
      class="absolute inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
    >
      <!-- Blurred Backdrop -->
      <div class="absolute inset-0 bg-primary/5 transition-opacity duration-300"></div>

      <!-- High-Fidelity Card -->
      <Transition name="scale-in" appear>
        <div
          class="relative ui-panel rounded-md px-8 py-6 text-center flex flex-col items-center gap-4 border border-primary/20 max-w-sm w-full"
        >
          <div
            class="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20"
          >
            <UploadCloud class="w-7 h-7 text-primary" />
          </div>

          <!-- Text Content -->
          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-foreground">Release to append</h3>
            <p
              class="ui-caption ui-mono uppercase tracking-[0.2em]"
            >
              PDF / IMAGES / PROJECT FILES
            </p>
          </div>

          <!-- Decorative bottom line -->
          <div class="w-10 h-px bg-primary/40"></div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Fade effect for the background */
.fade-backdrop-enter-active,
.fade-backdrop-leave-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-backdrop-enter-from,
.fade-backdrop-leave-to {
  opacity: 0;
}

/* Scale-in effect for the central card */
.scale-in-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.scale-in-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-backdrop-enter-active,
  .fade-backdrop-leave-active,
  .scale-in-enter-active {
    transition: none !important;
  }

  .fade-backdrop-enter-from,
  .fade-backdrop-leave-to,
  .scale-in-enter-from {
    opacity: 1 !important;
    transform: none !important;
  }
}

</style>
