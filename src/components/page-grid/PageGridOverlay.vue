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
      <div
        class="absolute inset-0 bg-primary/5 backdrop-blur-[2px] transition-all duration-500"
      ></div>

      <!-- High-Fidelity Card -->
      <Transition name="scale-in" appear>
        <div
          class="relative glass-surface bg-background/40 rounded-3xl shadow-2xl px-12 py-10 text-center flex flex-col items-center gap-6 border-2 border-primary/20 max-w-sm w-full animate-float"
        >
          <!-- Animated Icon Container -->
          <div class="relative">
            <div class="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
            <div
              class="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/30 shadow-inner"
            >
              <UploadCloud class="w-10 h-10 text-primary animate-bounce-subtle" />
            </div>
          </div>

          <!-- Text Content -->
          <div class="space-y-2">
            <h3 class="text-xl font-bold tracking-tight text-foreground antialiased uppercase">
              Release to Append
            </h3>
            <p
              class="text-xs font-medium text-muted-foreground/80 tracking-wide font-mono antialiased"
            >
              PDF · IMAGES · PROJECT FILES
            </p>
          </div>

          <!-- Decorative bottom line -->
          <div class="w-12 h-1 bg-primary/40 rounded-full"></div>
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

/* Subtle floating animation */
@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}

/* Custom subtle bounce */
@keyframes bounce-subtle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
.animate-bounce-subtle {
  animation: bounce-subtle 2s ease-in-out infinite;
}
</style>
