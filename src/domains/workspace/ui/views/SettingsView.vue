<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Cog,
  Database,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-vue-next'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useStorageGC } from '@/domains/workspace/application/useStorageGC'
import { useToast } from '@/shared/composables/useToast'
import { useSettingsStore, type ThemePreference } from '@/domains/workspace/store/settings.store'
import { ZOOM } from '@/shared/constants'
import { formatFilenamePattern } from '@/shared/utils/filename-pattern'
import { formatBytes } from '@/shared/utils/format'
import type { SettingsCategoryItem, SettingsStorageSegmentView } from '@/shared/types/settings'
import SettingsCategoryNav from '@/domains/workspace/ui/components/settings/SettingsCategoryNav.vue'
import SettingsGeneralSection from '@/domains/workspace/ui/components/settings/SettingsGeneralSection.vue'
import SettingsEditorSection from '@/domains/workspace/ui/components/settings/SettingsEditorSection.vue'
import SettingsExportSection from '@/domains/workspace/ui/components/settings/SettingsExportSection.vue'
import SettingsStorageSection from '@/domains/workspace/ui/components/settings/SettingsStorageSection.vue'

type SettingsCategory = 'general' | 'editor' | 'export' | 'storage'
type StorageSegmentId = 'active' | 'trash' | 'cache' | 'free'

type StorageSegment = {
  id: StorageSegmentId
  label: string
  bytes: number
  barClass: string
  dotClass: string
}

const settings = useSettingsStore()
const { confirm } = useConfirm()
const toast = useToast()
const { preferences } = storeToRefs(settings)
const activeCategory = shallowRef<SettingsCategory>('general')
const isStorageActionPending = shallowRef(false)

const {
  breakdown: storageBreakdown,
  isRefreshingStorage,
  refreshStorage,
  emptyTrash: emptyStorageTrash,
  runGarbageCollection: runStorageGarbageCollection,
  nukeAllData,
} = useStorageGC()

const categories: ReadonlyArray<SettingsCategoryItem> = [
  {
    id: 'general',
    label: 'General',
    description: 'Theme and motion behavior',
    icon: Cog,
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Workspace defaults',
    icon: SlidersHorizontal,
  },
  {
    id: 'export',
    label: 'Export',
    description: 'Metadata and filename defaults',
    icon: Sparkles,
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Disk usage and cleanup',
    icon: Database,
  },
]

function clampZoom(value: number): number {
  return Math.min(ZOOM.MAX, Math.max(ZOOM.MIN, value))
}

function clampTrashRetentionDays(value: number): number {
  return Math.min(365, Math.max(1, value))
}

const themePreference = computed({
  get: () => preferences.value.theme,
  set: (value: ThemePreference) => {
    preferences.value.theme = value
  },
})

const reducedMotion = computed({
  get: () => preferences.value.reducedMotion,
  set: (value: boolean) => {
    preferences.value.reducedMotion = value
  },
})

const defaultGridZoomModel = computed<number[]>({
  get: () => [clampZoom(preferences.value.defaultGridZoom)],
  set: (value) => {
    const next = Number(value[0] ?? ZOOM.DEFAULT)
    preferences.value.defaultGridZoom = clampZoom(next)
  },
})

const defaultGridZoom = computed(() => clampZoom(preferences.value.defaultGridZoom))

const defaultAuthor = computed({
  get: () => preferences.value.defaultAuthor,
  set: (value: string | number) => {
    preferences.value.defaultAuthor = String(value)
  },
})

const filenamePattern = computed({
  get: () => preferences.value.filenamePattern,
  set: (value: string | number) => {
    preferences.value.filenamePattern = String(value)
  },
})

const autoGenerateOutlineSinglePage = computed({
  get: () => preferences.value.autoGenerateOutlineSinglePage,
  set: (value: boolean) => {
    preferences.value.autoGenerateOutlineSinglePage = value
  },
})

const autoDeleteTrashDaysInput = computed({
  get: () => String(preferences.value.autoDeleteTrashDays),
  set: (value: string | number) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    preferences.value.autoDeleteTrashDays = clampTrashRetentionDays(Math.round(parsed))
  },
})

const filenamePreview = computed(() =>
  formatFilenamePattern(filenamePattern.value, {
    originalName: 'invoice_2026',
    name: 'invoice_2026',
    version: 3,
  }),
)

const storageChartTotal = computed(() => {
  const usedBytes = storageBreakdown.value.usedBytes
  const quotaBytes = storageBreakdown.value.quotaBytes

  if (typeof quotaBytes === 'number' && quotaBytes > 0) {
    return Math.max(quotaBytes, usedBytes, 1)
  }

  return Math.max(usedBytes, 1)
})

const storageSegments = computed<StorageSegment[]>(() => {
  const segments: StorageSegment[] = [
    {
      id: 'active',
      label: 'Active Projects',
      bytes: storageBreakdown.value.activeBytes,
      barClass: 'bg-primary',
      dotClass: 'bg-primary',
    },
    {
      id: 'trash',
      label: 'Trash',
      bytes: storageBreakdown.value.trashBytes,
      barClass: 'bg-amber-500',
      dotClass: 'bg-amber-500',
    },
    {
      id: 'cache',
      label: 'Cache',
      bytes: storageBreakdown.value.cacheBytes,
      barClass: 'bg-sky-500',
      dotClass: 'bg-sky-500',
    },
  ]

  if (typeof storageBreakdown.value.freeBytes === 'number') {
    segments.push({
      id: 'free',
      label: 'Empty Space',
      bytes: storageBreakdown.value.freeBytes,
      barClass: 'bg-muted-foreground/20',
      dotClass: 'bg-muted-foreground/60',
    })
  }

  return segments
})

const isStorageBusy = computed(() => isStorageActionPending.value || isRefreshingStorage.value)
const hasTrashData = computed(() => storageBreakdown.value.trashBytes > 0)
const hasCacheData = computed(() => storageBreakdown.value.cacheBytes > 0)

const storageUsedLabel = computed(() => formatBytes(storageBreakdown.value.usedBytes))
const storageQuotaLabel = computed(() => {
  if (typeof storageBreakdown.value.quotaBytes !== 'number') return 'Unavailable'
  return formatBytes(storageBreakdown.value.quotaBytes)
})

const storageSegmentsView = computed<SettingsStorageSegmentView[]>(() =>
  storageSegments.value.map((segment) => {
    const ratio = segment.bytes <= 0 ? 0 : Math.max(0, Math.min(1, segment.bytes / storageChartTotal.value))
    return {
      id: segment.id,
      label: segment.label,
      bytesLabel: formatBytes(segment.bytes),
      barClass: segment.barClass,
      dotClass: segment.dotClass,
      widthPercent: ratio * 100,
    }
  }),
)

async function refreshStorageStats(): Promise<void> {
  try {
    await refreshStorage()
  } catch (error) {
    toast.error(
      'Failed to load storage stats',
      error instanceof Error ? error.message : 'Unknown error',
    )
  }
}

async function handleEmptyTrashStorage(): Promise<void> {
  if (isStorageBusy.value || !hasTrashData.value) return

  const confirmed = await confirm({
    title: 'Empty trash now?',
    message: `This permanently removes ${formatBytes(storageBreakdown.value.trashBytes)} from trash.`,
    confirmText: 'Empty Trash',
    variant: 'danger',
  })

  if (!confirmed) return

  isStorageActionPending.value = true
  try {
    const deletedCount = await emptyStorageTrash()
    toast.success(
      'Trash emptied',
      deletedCount > 0
        ? `Deleted ${deletedCount} project${deletedCount === 1 ? '' : 's'}.`
        : 'No trashed projects found.',
    )
  } catch (error) {
    toast.error('Failed to empty trash', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isStorageActionPending.value = false
  }
}

async function handleClearCache(): Promise<void> {
  if (isStorageBusy.value || !hasCacheData.value) return

  const cacheBefore = storageBreakdown.value.cacheBytes
  isStorageActionPending.value = true
  try {
    await runStorageGarbageCollection()
    const reclaimedBytes = Math.max(0, cacheBefore - storageBreakdown.value.cacheBytes)
    toast.success(
      'Cache cleared',
      reclaimedBytes > 0 ? `${formatBytes(reclaimedBytes)} reclaimed.` : 'No orphan cache files found.',
    )
  } catch (error) {
    toast.error('Failed to clear cache', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isStorageActionPending.value = false
  }
}

async function handleNukeData(): Promise<void> {
  if (isStorageBusy.value) return

  const confirmed = await confirm({
    title: 'Delete all local data?',
    message: 'This removes all projects, trash, workflows, and cached files permanently.',
    confirmText: 'Delete All Data',
    variant: 'danger',
  })

  if (!confirmed) return

  isStorageActionPending.value = true
  try {
    await nukeAllData()
    toast.success('All local data deleted')
  } catch (error) {
    toast.error('Failed to delete all data', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isStorageActionPending.value = false
  }
}

onMounted(() => {
  void refreshStorageStats()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="border-b border-border/50 px-4 sm:px-6 lg:px-8 h-16 shrink-0 bg-sidebar">
      <div class="h-full flex items-center gap-2.5">
        <SidebarTrigger class="md:hidden" />
        <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Settings</h1>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsCategoryNav
          :categories="categories"
          :active-category="activeCategory"
          @select="activeCategory = $event as SettingsCategory"
        />

        <div class="ui-panel p-5 space-y-8">
          <SettingsGeneralSection
            v-if="activeCategory === 'general'"
            v-model:theme-preference="themePreference"
            v-model:reduced-motion="reducedMotion"
          />

          <SettingsEditorSection
            v-if="activeCategory === 'editor'"
            v-model:default-grid-zoom-model="defaultGridZoomModel"
            :default-grid-zoom="defaultGridZoom"
            :zoom-min="ZOOM.MIN"
            :zoom-max="ZOOM.MAX"
            :zoom-step="ZOOM.STEP"
            v-model:auto-generate-outline-single-page="autoGenerateOutlineSinglePage"
            v-model:auto-delete-trash-days-input="autoDeleteTrashDaysInput"
          />

          <SettingsExportSection
            v-if="activeCategory === 'export'"
            v-model:default-author="defaultAuthor"
            v-model:filename-pattern="filenamePattern"
            :filename-preview="filenamePreview"
          />

          <SettingsStorageSection
            v-if="activeCategory === 'storage'"
            :segments="storageSegmentsView"
            :storage-used-label="storageUsedLabel"
            :storage-quota-label="storageQuotaLabel"
            :is-storage-busy="isStorageBusy"
            :has-trash-data="hasTrashData"
            :has-cache-data="hasCacheData"
            @refresh="refreshStorageStats"
            @empty-trash="handleEmptyTrashStorage"
            @clear-cache="handleClearCache"
            @nuke="handleNukeData"
          />
        </div>
      </div>
    </div>
  </section>
</template>

