<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Clock, Settings, Trash2, Workflow } from 'lucide-vue-next'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from '@/shared/components/ui/sidebar'

type DashboardRouteName =
  | 'dashboard'
  | 'dashboard-trash'
  | 'dashboard-workflows'
  | 'dashboard-settings'

const route = useRoute()

const navItems: ReadonlyArray<{
  icon: typeof Clock
  label: string
  routeName: DashboardRouteName
  to: { name: DashboardRouteName }
}> = [
  { icon: Clock, label: 'Recents', routeName: 'dashboard', to: { name: 'dashboard' } },
  { icon: Trash2, label: 'Trash', routeName: 'dashboard-trash', to: { name: 'dashboard-trash' } },
  {
    icon: Workflow,
    label: 'Workflows',
    routeName: 'dashboard-workflows',
    to: { name: 'dashboard-workflows' },
  },
  {
    icon: Settings,
    label: 'Settings',
    routeName: 'dashboard-settings',
    to: { name: 'dashboard-settings' },
  },
]

const activeRouteName = computed(() => String(route.name ?? ''))

function isRouteActive(name: DashboardRouteName): boolean {
  return activeRouteName.value === name
}
</script>

<template>
  <SidebarProvider class="h-full w-full bg-sidebar text-foreground overflow-hidden">
    <Sidebar class="border-sidebar-border">
      <SidebarHeader class="h-16 px-4 flex-row items-center">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 bg-primary rounded flex items-center justify-center shadow-sm">
            <div class="w-3 h-3 bg-white rounded-sm"></div>
          </div>
          <span class="font-bold text-sm tracking-wide">FluxPDF</span>
        </div>
      </SidebarHeader>

      <SidebarContent class="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem v-for="item in navItems" :key="item.routeName">
            <SidebarMenuButton as-child :is-active="isRouteActive(item.routeName)">
              <RouterLink :to="item.to">
                <component :is="item.icon" class="w-4 h-4" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <div class="px-4 py-2">
        <SidebarSeparator class="mx-0" />
      </div>

      <SidebarFooter class="px-4 py-4">
        <div class="ui-caption">
          <p>Local-First Architecture</p>
          <p class="opacity-50">v1.0.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset class="min-w-0">
      <RouterView />
    </SidebarInset>
  </SidebarProvider>
</template>
