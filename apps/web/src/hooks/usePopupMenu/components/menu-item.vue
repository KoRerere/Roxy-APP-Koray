<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem';
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon'

defineProps<{
  item: MenuItem
}>()

</script>

<template>
  <a class="max-w-80 flex items-center py-2 pl-2.5 pr-2.5 gap-2 cursor-pointer">
    <slot>
      <RxSvgIcon v-if="item.icon" :name="(item.icon as SvgNames)" />
      <span class="ellipsis-1 text-[13px]" :title="(item.label as string)">{{ item.label }}</span>
    </slot>
  </a>
</template>

<style scoped></style>