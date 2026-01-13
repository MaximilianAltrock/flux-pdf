<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Eye, EyeOff } from 'lucide-vue-next'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const showUserPassword = ref(false)
const showOwnerPassword = ref(false)

const securityEncrypted = computed({
  get: () => props.state.document.security.isEncrypted,
  set: (value) => props.actions.setSecurity({ isEncrypted: value }),
})

const securityUserPassword = computed({
  get: () => props.state.document.security.userPassword ?? '',
  set: (value) => props.actions.setSecurity({ userPassword: value }),
})

const securityOwnerPassword = computed({
  get: () => props.state.document.security.ownerPassword ?? '',
  set: (value) => props.actions.setSecurity({ ownerPassword: value }),
})

const allowPrinting = computed({
  get: () => props.state.document.security.allowPrinting,
  set: (value) => props.actions.setSecurity({ allowPrinting: value }),
})

const allowCopying = computed({
  get: () => props.state.document.security.allowCopying,
  set: (value) => props.actions.setSecurity({ allowCopying: value }),
})

const allowModifying = computed({
  get: () => props.state.document.security.allowModifying,
  set: (value) => props.actions.setSecurity({ allowModifying: value }),
})
</script>

<template>
  <div class="space-y-6">
    <div
      class="bg-muted/30 border border-border/50 rounded-lg p-4 transition-all"
      :class="
        props.state.document.security.isEncrypted
          ? 'border-primary/20 ring-1 ring-primary/5 bg-primary/[0.02]'
          : ''
      "
    >
      <Field orientation="horizontal" class="items-center justify-between gap-4">
        <div class="space-y-0.5">
          <FieldLabel
            for="security-encrypted"
            class="text-xs font-bold text-foreground transition-colors"
            :class="props.state.document.security.isEncrypted ? 'text-primary' : ''"
          >
            Document Encryption
          </FieldLabel>
          <p class="text-xxs text-muted-foreground/60 leading-tight">
            Apply password protection to this file
          </p>
        </div>
        <Switch
          id="security-encrypted"
          :checked="securityEncrypted"
          @update:checked="(v: boolean) => (securityEncrypted = v)"
          class="data-[state=checked]:bg-primary"
        />
      </Field>
    </div>

    <!-- Password Fields (Animated) -->
    <div
      class="space-y-6 overflow-hidden transition-all duration-500 ease-out"
      :class="
        props.state.document.security.isEncrypted
          ? 'opacity-100 max-h-[800px] blur-0'
          : 'opacity-0 max-h-0 blur-sm pointer-events-none'
      "
    >
      <FieldGroup class="gap-5 px-1">
        <!-- User Pass -->
        <Field>
          <div class="flex justify-between items-center mb-1.5">
            <FieldLabel
              for="security-user-pass"
              class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold"
              >Open Password</FieldLabel
            >
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 opacity-50 hover:opacity-100 transition-opacity"
              @click="showUserPassword = !showUserPassword"
            >
              <Eye v-if="!showUserPassword" class="w-3 h-3" />
              <EyeOff v-else class="w-3 h-3" />
            </Button>
          </div>
          <FieldContent>
            <Input
              id="security-user-pass"
              v-model="securityUserPassword"
              :type="showUserPassword ? 'text' : 'password'"
              class="h-8 text-xs bg-background/50 border-border/60"
              placeholder="Required to open document"
            />
          </FieldContent>
        </Field>

        <!-- Owner Pass -->
        <Field>
          <div class="flex justify-between items-center mb-1.5">
            <FieldLabel
              for="security-owner-pass"
              class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold"
              >Permissions Password</FieldLabel
            >
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 opacity-50 hover:opacity-100 transition-opacity"
              @click="showOwnerPassword = !showOwnerPassword"
            >
              <Eye v-if="!showOwnerPassword" class="w-3 h-3" />
              <EyeOff v-else class="w-3 h-3" />
            </Button>
          </div>
          <FieldContent>
            <Input
              id="security-owner-pass"
              v-model="securityOwnerPassword"
              :type="showOwnerPassword ? 'text' : 'password'"
              class="h-8 text-xs bg-background/50 border-border/60"
              placeholder="Required to change settings"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <!-- Permissions Matrix -->
      <div class="space-y-4 pt-2 border-t border-border/40">
        <FieldLabel class="text-xs font-bold text-foreground px-1">Access Control</FieldLabel>
        <div class="grid gap-3 bg-muted/20 border border-border/30 rounded-md p-3">
          <Field orientation="horizontal" class="items-center gap-3">
            <Checkbox
              id="perm-print"
              :checked="allowPrinting"
              @update:checked="(v: boolean) => (allowPrinting = v)"
              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <div class="space-y-0.5">
              <FieldLabel
                for="perm-print"
                class="text-xs font-medium text-foreground/80 cursor-pointer"
              >
                High Quality Printing
              </FieldLabel>
              <p class="text-xxs text-muted-foreground/50 leading-none">
                Allows high-res print output
              </p>
            </div>
          </Field>

          <Field orientation="horizontal" class="items-center gap-3">
            <Checkbox
              id="perm-copy"
              :checked="allowCopying"
              @update:checked="(v: boolean) => (allowCopying = v)"
              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <div class="space-y-0.5">
              <FieldLabel
                for="perm-copy"
                class="text-xs font-medium text-foreground/80 cursor-pointer"
              >
                content copying
              </FieldLabel>
              <p class="text-xxs text-muted-foreground/50 leading-none">Extract text and images</p>
            </div>
          </Field>

          <Field orientation="horizontal" class="items-center gap-3">
            <Checkbox
              id="perm-mod"
              :checked="allowModifying"
              @update:checked="(v: boolean) => (allowModifying = v)"
              class="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <div class="space-y-0.5">
              <FieldLabel
                for="perm-mod"
                class="text-xs font-medium text-foreground/80 cursor-pointer"
              >
                modification
              </FieldLabel>
              <p class="text-xxs text-muted-foreground/50 leading-none">
                Reorder, delete or insert pages
              </p>
            </div>
          </Field>
        </div>
      </div>
    </div>
  </div>
</template>
