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
  <div class="space-y-6 pb-6">
    <div
      class="bg-muted/10 border border-border/30 rounded-lg p-3 transition-all"
      :class="
        props.state.document.security.isEncrypted
          ? 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.03]'
          : 'bg-muted/5'
      "
    >
      <Field orientation="horizontal" class="items-center justify-between gap-4">
        <div class="space-y-1">
          <FieldLabel
            for="security-encrypted"
            class="text-tiny font-bold text-foreground transition-colors uppercase tracking-wider"
            :class="
              props.state.document.security.isEncrypted
                ? 'text-primary'
                : 'text-muted-foreground/70'
            "
          >
            Encryption
          </FieldLabel>
          <p class="text-xxs text-muted-foreground/40 leading-tight font-medium">
            Password protect this document
          </p>
        </div>
        <Switch
          id="security-encrypted"
          :checked="securityEncrypted"
          @update:checked="(v: boolean) => (securityEncrypted = v)"
          class="data-[state=checked]:bg-primary h-5 w-9"
        />
      </Field>
    </div>

    <!-- Password Fields (Animated) -->
    <div
      class="space-y-6 overflow-hidden transition-all duration-500 ease-in-out"
      :class="
        props.state.document.security.isEncrypted
          ? 'opacity-100 max-h-[800px] blur-0'
          : 'opacity-0 max-h-0 blur-sm pointer-events-none'
      "
    >
      <FieldGroup class="gap-5 px-1">
        <!-- User Pass -->
        <Field>
          <div class="flex justify-between items-center mb-2">
            <FieldLabel
              for="security-user-pass"
              class="text-xxs uppercase tracking-[0.15em] text-muted-foreground/50 font-bold flex items-center gap-2"
            >
              <div class="w-1 h-1 rounded-full bg-primary/40"></div>
              Open Password
            </FieldLabel>
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 text-muted-foreground/30 hover:text-foreground transition-colors rounded-[3px]"
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
              class="h-8 text-xs font-mono bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] transition-all"
              placeholder="••••••••"
            />
          </FieldContent>
        </Field>

        <!-- Owner Pass -->
        <Field>
          <div class="flex justify-between items-center mb-2">
            <FieldLabel
              for="security-owner-pass"
              class="text-xxs uppercase tracking-[0.15em] text-muted-foreground/50 font-bold flex items-center gap-2"
            >
              <div class="w-1 h-1 rounded-full bg-primary/40"></div>
              Admin Password
            </FieldLabel>
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 text-muted-foreground/30 hover:text-foreground transition-colors rounded-[3px]"
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
              class="h-8 text-[11px] font-mono bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] transition-all"
              placeholder="••••••••"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <!-- Permissions Matrix -->
      <div class="space-y-4 pt-4 border-t border-border/30">
        <FieldLabel
          class="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold px-1"
          >Access Control</FieldLabel
        >
        <div class="grid gap-2 bg-muted/5 border border-border/20 rounded-lg p-2">
          <label
            for="perm-print"
            class="flex items-center gap-3 p-2 rounded-md hover:bg-muted/10 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-print"
                :checked="allowPrinting"
                @update:checked="(v: boolean) => (allowPrinting = v)"
                class="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4 rounded-[3px]"
              />
            </div>
            <div class="space-y-0.5">
              <span
                class="text-xs font-bold text-foreground/70 group-hover:text-foreground transition-colors uppercase tracking-tight"
              >
                High-Res Printing
              </span>
              <p class="text-xxs text-muted-foreground/30 leading-none font-medium">
                Allow high fidelity output
              </p>
            </div>
          </label>

          <label
            for="perm-copy"
            class="flex items-center gap-3 p-2 rounded-md hover:bg-muted/10 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-copy"
                :checked="allowCopying"
                @update:checked="(v: boolean) => (allowCopying = v)"
                class="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4 rounded-[3px]"
              />
            </div>
            <div class="space-y-0.5">
              <span
                class="text-xs font-bold text-foreground/70 group-hover:text-foreground transition-colors uppercase tracking-tight"
              >
                Content Copying
              </span>
              <p class="text-xxs text-muted-foreground/30 leading-none font-medium">
                Extract text and media
              </p>
            </div>
          </label>

          <label
            for="perm-mod"
            class="flex items-center gap-3 p-2 rounded-md hover:bg-muted/10 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-mod"
                :checked="allowModifying"
                @update:checked="(v: boolean) => (allowModifying = v)"
                class="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4 rounded-[3px]"
              />
            </div>
            <div class="space-y-0.5">
              <span
                class="text-[11px] font-bold text-foreground/70 group-hover:text-foreground transition-colors uppercase tracking-tight"
              >
                Modification
              </span>
              <p class="text-[10px] text-muted-foreground/30 leading-none font-medium">
                Reorder or delete pages
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
