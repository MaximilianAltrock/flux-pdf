<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Cog,
  Database,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
} from 'lucide-vue-next'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/composables/useConfirm'
import { useStorageGC } from '@/composables/useStorageGC'
import { useToast } from '@/composables/useToast'
import { useSettingsStore, type ThemePreference } from '@/stores/settings'
import { ZOOM } from '@/constants'
import { formatFilenamePattern } from '@/utils/filename-pattern'
import { formatBytes } from '@/utils/format'

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

const categories: ReadonlyArray<{
  id: SettingsCategory
  label: string
  description: string
  icon: typeof Cog
}> = [
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

function storageSegmentStyle(bytes: number): { width: string } {
  if (bytes <= 0) return { width: '0%' }
  const ratio = Math.max(0, Math.min(1, bytes / storageChartTotal.value))
  return { width: `${ratio * 100}%` }
}

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
        <aside class="ui-panel p-3 h-fit">
          <p class="ui-kicker px-2 pb-2">Categories</p>
          <div class="space-y-1">
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              @click="activeCategory = category.id"
              class="w-full text-left rounded-md px-3 py-2.5 transition-colors border"
              :class="
                activeCategory === category.id
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-transparent border-transparent hover:bg-muted/30 text-foreground'
              "
            >
              <div class="flex items-center gap-2.5">
                <component :is="category.icon" class="w-4 h-4 shrink-0" />
                <div class="min-w-0">
                  <p class="ui-label">{{ category.label }}</p>
                  <p class="ui-caption truncate">{{ category.description }}</p>
                </div>
              </div>
            </button>
          </div>
        </aside>

        <div class="ui-panel p-5 space-y-8">
          <section v-if="activeCategory === 'general'" class="space-y-6">
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
                  :variant="themePreference === 'light' ? 'default' : 'ghost'"
                  class="w-full"
                  @click="themePreference = 'light'"
                >
                  <Sun class="w-4 h-4" />
                  Light
                </Button>
                <Button
                  type="button"
                  size="sm"
                  :variant="themePreference === 'dark' ? 'default' : 'ghost'"
                  class="w-full"
                  @click="themePreference = 'dark'"
                >
                  <Moon class="w-4 h-4" />
                  Dark
                </Button>
                <Button
                  type="button"
                  size="sm"
                  :variant="themePreference === 'system' ? 'default' : 'ghost'"
                  class="w-full"
                  @click="themePreference = 'system'"
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
              <Switch id="settings-reduced-motion" v-model="reducedMotion" />
            </label>
          </section>

          <section v-if="activeCategory === 'editor'" class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">Editor Defaults</h2>
              <p class="ui-caption">Applied to newly created projects.</p>
            </div>

            <div class="ui-panel-muted rounded-md p-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <p class="ui-label">Grid density</p>
                <span class="ui-mono ui-caption">{{ defaultGridZoom }}px</span>
              </div>
              <Slider
                v-model="defaultGridZoomModel"
                :min="ZOOM.MIN"
                :max="ZOOM.MAX"
                :step="ZOOM.STEP"
              />
              <p class="ui-caption">
                Controls default thumbnail size in the editor page grid.
              </p>
            </div>

            <label
              for="settings-auto-outline"
              class="ui-panel-muted flex items-center justify-between gap-4 rounded-md p-4 cursor-pointer"
            >
              <div class="space-y-1">
                <p class="ui-label">Auto-generate outline for single-page imports</p>
                <p class="ui-caption">Moved here from the editor panel.</p>
              </div>
              <Switch id="settings-auto-outline" v-model="autoGenerateOutlineSinglePage" />
            </label>

            <div class="ui-panel-muted rounded-md p-4 space-y-2">
              <label for="settings-trash-days" class="ui-label">Auto-delete trash after (days)</label>
              <Input
                id="settings-trash-days"
                v-model="autoDeleteTrashDaysInput"
                type="number"
                min="1"
                max="365"
              />
              <p class="ui-caption">Retention policy is stored now and used by Trash automation later.</p>
            </div>
          </section>

          <section v-if="activeCategory === 'export'" class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">Export Defaults</h2>
              <p class="ui-caption">Used by project creation and export filename suggestions.</p>
            </div>

            <div class="ui-panel-muted rounded-md p-4 space-y-2">
              <label for="settings-default-author" class="ui-label">Default author</label>
              <Input
                id="settings-default-author"
                v-model="defaultAuthor"
                placeholder="Jane Doe"
              />
              <p class="ui-caption">Applied to metadata when a new project is created.</p>
            </div>

            <div class="ui-panel-muted rounded-md p-4 space-y-3">
              <label for="settings-filename-pattern" class="ui-label">Filename pattern</label>
              <Input
                id="settings-filename-pattern"
                v-model="filenamePattern"
                placeholder="{name}_v{version}"
                class="ui-mono"
              />
              <p class="ui-caption">
                Tokens: <span class="ui-mono">{name}</span>,
                <span class="ui-mono">{original_name}</span>,
                <span class="ui-mono">{date}</span>,
                <span class="ui-mono">{version}</span>
              </p>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="ui-kicker mb-1">Preview</p>
                <p class="ui-mono text-sm">{{ filenamePreview }}.pdf</p>
              </div>
            </div>
          </section>

          <section v-if="activeCategory === 'storage'" class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">Storage Management</h2>
              <p class="ui-caption">Monitor local disk usage and run cleanup actions.</p>
            </div>

            <div class="ui-panel-muted rounded-md p-4 space-y-4">
              <div class="flex items-center justify-between gap-3">
                <p class="ui-label">Disk Utility</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  :disabled="isStorageBusy"
                  @click="refreshStorageStats"
                >
                  Refresh
                </Button>
              </div>

              <div class="h-3 w-full rounded-full overflow-hidden border border-border/60 bg-background/70 flex">
                <div
                  v-for="segment in storageSegments"
                  :key="segment.id"
                  class="h-full transition-[width] duration-300"
                  :class="segment.barClass"
                  :style="storageSegmentStyle(segment.bytes)"
                />
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <div
                  v-for="segment in storageSegments"
                  :key="`legend-${segment.id}`"
                  class="rounded-md border border-border/50 bg-background/70 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full" :class="segment.dotClass" />
                    <span class="ui-caption">{{ segment.label }}</span>
                  </div>
                  <span class="ui-mono ui-caption">{{ formatBytes(segment.bytes) }}</span>
                </div>
              </div>

              <p class="ui-caption">
                FluxPDF data: <span class="ui-mono">{{ storageUsedLabel }}</span>
                <span> - Quota: <span class="ui-mono">{{ storageQuotaLabel }}</span></span>
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div class="ui-panel-muted rounded-md p-4 space-y-3">
                <div class="space-y-1">
                  <p class="ui-label">Trash</p>
                  <p class="ui-caption">Permanently removes trashed projects and their unused sources.</p>
                </div>
                <Button
                  type="button"
                  class="w-full gap-2"
                  variant="outline"
                  :disabled="isStorageBusy || !hasTrashData"
                  @click="handleEmptyTrashStorage"
                >
                  <Trash2 class="w-4 h-4" />
                  Empty Trash
                </Button>
              </div>

              <div class="ui-panel-muted rounded-md p-4 space-y-3">
                <div class="space-y-1">
                  <p class="ui-label">Cache</p>
                  <p class="ui-caption">Runs file garbage collection and clears runtime document caches.</p>
                </div>
                <Button
                  type="button"
                  class="w-full gap-2"
                  variant="outline"
                  :disabled="isStorageBusy || !hasCacheData"
                  @click="handleClearCache"
                >
                  <Database class="w-4 h-4" />
                  Clear Cache
                </Button>
              </div>

              <div class="ui-panel-muted rounded-md p-4 space-y-3 border-destructive/30">
                <div class="space-y-1">
                  <p class="ui-label text-destructive">Danger Zone</p>
                  <p class="ui-caption">Deletes all projects, workflows, and local settings from this browser.</p>
                </div>
                <Button
                  type="button"
                  class="w-full gap-2 text-destructive border-destructive/40 hover:text-destructive"
                  variant="outline"
                  :disabled="isStorageBusy"
                  @click="handleNukeData"
                >
                  <TriangleAlert class="w-4 h-4" />
                  Nuke
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
