<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import type { ThemePreference } from '@/domains/workspace/store/settings.store'

const props = defineProps<{
  themePreference: ThemePreference
  reducedMotion: boolean
}>()

const emit = defineEmits<{
  'update:themePreference': [value: ThemePreference]
  'update:reducedMotion': [value: boolean]
}>()

const themeModel = computed({
  get: () => props.themePreference,
  set: (value: ThemePreference) => emit('update:themePreference', value),
})

const reducedMotionModel = computed({
  get: () => props.reducedMotion,
  set: (value: boolean) => emit('update:reducedMotion', value),
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-1">
      <h2 class="text-base font-semibold">General & Appearance</h2>
      <p class="ui-caption">Hot-applied and saved locally as you change values.</p>
    </div>

    <div class="space-y-3">
      <p class="ui-kicker">Theme</p>
      <div class="grid grid-cols-3 gap-2 ui-panel-muted p-1 rounded-md">
        <Button
          type="button"
          size="sm"
          :variant="themeModel === 'light' ? 'default' : 'ghost'"
          class="w-full"
          @click="themeModel = 'light'"
        >
          <Sun class="w-4 h-4" />
          Light
        </Button>
        <Button
          type="button"
          size="sm"
          :variant="themeModel === 'dark' ? 'default' : 'ghost'"
          class="w-full"
          @click="themeModel = 'dark'"
        >
          <Moon class="w-4 h-4" />
          Dark
        </Button>
        <Button
          type="button"
          size="sm"
          :variant="themeModel === 'system' ? 'default' : 'ghost'"
          class="w-full"
          @click="themeModel = 'system'"
        >
          System
        </Button>
      </div>
    </div>

    <label
      for="settings-reduced-motion"
      class="ui-panel-muted flex items-center justify-between gap-4 rounded-md p-4 cursor-pointer"
    >
      <div class="space-y-1">
        <p class="ui-label">Reduced motion</p>
        <p class="ui-caption">Disable fly-in and view-transition effects.</p>
      </div>
      <Switch id="settings-reduced-motion" v-model="reducedMotionModel" />
    </label>
  </section>
</template>

