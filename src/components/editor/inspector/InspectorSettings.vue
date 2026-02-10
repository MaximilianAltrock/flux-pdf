<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const router = useRouter()

function openGlobalSettings() {
  void router.push('/settings')
}
</script>

<template>
  <div class="ui-panel-muted rounded-md p-4 space-y-3">
    <p class="ui-label">Global settings moved to Dashboard</p>
    <p class="ui-caption">
      Use <span class="ui-mono">/settings</span> for app-wide preferences.
    </p>
    <Button size="sm" variant="outline" @click="openGlobalSettings">Open Settings</Button>
  </div>
</template>
