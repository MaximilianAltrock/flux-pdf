<script setup lang="ts">
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import InspectorMetadata from '@/components/editor/inspector/InspectorMetadata.vue'
import InspectorSecurity from '@/components/editor/inspector/InspectorSecurity.vue'
import InspectorSettings from '@/components/editor/inspector/InspectorSettings.vue'
defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <Drawer :open="open" @update:open="(val) => emit('update:open', val)">
    <DrawerContent>
      <div class="mx-auto w-full max-w-sm flex flex-col max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle class="text-center">Document Settings</DrawerTitle>
          <DrawerDescription class="sr-only">
            Configure metadata and security options.
          </DrawerDescription>
        </DrawerHeader>

        <Tabs default-value="metadata" class="flex-1 min-h-0 flex flex-col">
          <div class="px-4">
            <TabsList class="w-full grid grid-cols-3 ui-panel-muted p-1 rounded-md h-11">
              <TabsTrigger value="metadata" class="text-xs font-semibold h-9">Metadata</TabsTrigger>
              <TabsTrigger value="security" class="text-xs font-semibold h-9">Security</TabsTrigger>
              <TabsTrigger value="settings" class="text-xs font-semibold h-9">Settings</TabsTrigger>
            </TabsList>
          </div>

          <div class="flex-1 min-h-0 mt-4">
            <ScrollArea class="h-full">
              <TabsContent value="metadata" class="px-4 pb-6">
                <InspectorMetadata />
              </TabsContent>
              <TabsContent value="security" class="px-4 pb-6">
                <InspectorSecurity />
              </TabsContent>
              <TabsContent value="settings" class="px-4 pb-6">
                <InspectorSettings />
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DrawerFooter class="pt-0">
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>
