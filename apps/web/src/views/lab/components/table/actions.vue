<script setup lang="ts">
import type { ActionsItem } from './type'

const { model, data, showMenu = true, isPending = () => false } = defineProps<{
  model: ActionsItem[]
  data?: any
  /** 为 false 时只留快捷按钮，其余项改由右键菜单到达 */
  showMenu?: boolean
  /** 只标记正在执行的那一项 */
  isPending?: (item: ActionsItem) => boolean
}>()
const emit = defineEmits(['more'])

const quickActions = computed(() => model.filter(item => item.quick && item.icon && !item.onlyMultiple))
</script>

<template>
  <div class="flex items-center gap-1">
    <div
      v-for="item of quickActions"
      :key="item.key ?? item.icon"
      v-tooltip.top="{ value: item.disabled && item.disabledTooltip ? item.disabledTooltip : item.label, showDelay: 500 }"
    >
      <RxButton
        :icon="item.icon"
        :disabled="item.disabled || isPending(item)"
        :loading="isPending(item)"
        text
        size="xxs"
        severity="secondary"
        :on-click="(event: MouseEvent) => item.command?.({ originalEvent: event, item, data })"
      />
    </div>
    <RxButton v-if="showMenu" text size="xxs" severity="secondary" icon="base/rx_ic_more-v" :on-click="(event: MouseEvent) => emit('more', event)" />
  </div>
</template>

<style lang="scss" scoped></style>
