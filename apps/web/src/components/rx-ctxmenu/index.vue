<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps({
  operation: {
    type: Array as PropType<MenuItem[]>,
    required: true,
    default: () => [],
  },
  operationHandler: {
    type: Function as PropType<(item: MenuItem) => void>,
    required: true,
    default: () => () => { },
  },
})
const ctxMenu = ref()
</script>

<template>
  <ContextMenu ref="ctxMenu" :model="operation">
    <template #item="{ item, props: ctxProps }">
      <a v-ripple v-bind="ctxProps.action" @click="operationHandler(item)">
        <RxSvgIcon v-if="item.icon" :name="item.icon" :size="16" />
        <span>{{ item.label }}</span>
      </a>
    </template>
  </ContextMenu>
</template>

<style scoped></style>
