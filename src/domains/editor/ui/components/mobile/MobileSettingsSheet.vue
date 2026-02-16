<script setup lang="ts">
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
} from '@/shared/components/ui/drawer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import InspectorMetadata from '@/domains/editor/ui/components/inspector/InspectorMetadata.vue'
import InspectorSecurity from '@/domains/editor/ui/components/inspector/InspectorSecurity.vue'
import MobileDrawerHeader from '@/domains/editor/ui/components/mobile/MobileDrawerHeader.vue'
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
        <MobileDrawerHeader
          title="Document Details"
          description="Configure document metadata and security options."
        />

        <Tabs default-value="metadata" class="flex-1 min-h-0 flex flex-col">
          <div class="px-4">
            <TabsList class="w-full grid grid-cols-2 ui-panel-muted p-1 rounded-md h-11">
              <TabsTrigger value="metadata" class="text-xs font-semibold h-9">Metadata</TabsTrigger>
              <TabsTrigger value="security" class="text-xs font-semibold h-9">Security</TabsTrigger>
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
