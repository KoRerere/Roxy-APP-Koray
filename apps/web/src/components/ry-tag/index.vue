<script setup lang="ts">
import type { TagProps } from 'primevue/tag'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ TagProps {
  icon?: SvgNames
}

defineProps<Props>()
</script>

<template>
  <Tag>
    <template #icon>
      <RxSvgIcon v-if="icon" :name="icon" />
    </template>
    <template #default>
      <slot name="default" />
    </template>
  </Tag>
</template>

<style scoped></style>
