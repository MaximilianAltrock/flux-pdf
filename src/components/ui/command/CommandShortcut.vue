<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <span
    data-slot="command-shortcut"
    :class="cn('text-muted-foreground ml-auto ui-mono text-[10px] tracking-[0.2em]', props.class)"
  >
    <slot />
  </span>
</template>
