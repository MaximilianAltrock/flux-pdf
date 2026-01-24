<script setup lang="ts">
import { RouterView } from 'vue-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import Toaster from '@/components/ui/sonner/Sonner.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

import 'vue-sonner/style.css'
</script>
<template>
  <TooltipProvider>
    <div
      class="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden supports-[height:100dvh]:h-[100dvh]"
    >
      <div class="flex-1 min-h-0">
        <RouterView />
      </div>
      <Toaster />
      <ConfirmDialog />
    </div>
  </TooltipProvider>
</template>

<style scoped>
/* Minimal styles - layout-specific styles live in view components */
</style>
