<script setup lang="ts">
import type { MessageEmitsOptions, MessageProps } from 'primevue/message'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ MessageProps {
  icon?: SvgNames
}

defineProps<Props>()
defineEmits<MessageEmitsOptions>()

const { icon: iconSlot, ...slots } = useSlots()
</script>

<template>
  <Message>
    <template v-if="icon || iconSlot" #icon="slotProps">
      <slot name="icon" :slot-props="slotProps">
        <div class="flex items-center h-6">
          <RxSvgIcon v-if="icon" :name="icon" />
        </div>
      </slot>
    </template>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" :slot-props="slotProps" />
    </template>
  </Message>
</template>

<style lang="scss" scoped>
:deep(.p-message-close-button) {
  height: 24px;
}
</style>
