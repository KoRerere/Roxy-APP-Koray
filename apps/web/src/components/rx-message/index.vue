<script setup lang="ts">
import type { MessageProps } from 'primevue/message'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ MessageProps {
  icon?: SvgNames
}

defineProps<Props>()

const { icon: iconSlot, ...slots } = useSlots()
</script>

<template>
  <Message>
    <template v-if="icon || iconSlot" #icon="slotProps">
      <slot name="icon" :slot-props="slotProps">
        <RxSvgIcon v-if="icon" :name="icon" />
      </slot>
    </template>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" :slot-props="slotProps" />
    </template>
  </Message>
</template>

<style scoped></style>
