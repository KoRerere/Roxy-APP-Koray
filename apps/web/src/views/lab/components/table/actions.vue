<script setup lang="ts">
import type { ActionsItem } from './type'

const { model, data, showMenu = true, busy = false } = defineProps<{
  model: ActionsItem[]
  data?: any
  /** 为 false 时只留快捷按钮，其余项改由右键菜单到达 */
  showMenu?: boolean
  /** 表级操作锁，由 table 传入；不用 inject，DataTable 槽会断链 */
  busy?: boolean
}>()
const emit = defineEmits(['more'])

const quickActions = computed(() => model.filter(item => item.visible !== false && item.quick && item.icon && !item.onlyMultiple))
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton
      v-for="item of quickActions"
      :key="item.key ?? item.icon"
      :icon="item.icon"
      :disabled="item.disabled || busy"
      text
      size="xxs"
      severity="secondary"
      :on-click="(event: MouseEvent) => item.command?.({ originalEvent: event, item, data })"
    />
    <RxButton v-if="showMenu" :disabled="busy" text size="xxs" severity="secondary" icon="base/rx_ic_more-v" :on-click="(event: MouseEvent) => emit('more', event)" />
  </div>
</template>

<style lang="scss" scoped></style>
