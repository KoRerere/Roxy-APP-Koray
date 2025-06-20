<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon/'

interface Props {
  list: any[]
  icon?: SvgNames
  field?: string
  showMax?: number
  disabled?: boolean
}

const { field, list = [], showMax = 1, disabled = true } = defineProps<Props>()

const hasBindCount = computed(() => list.length > 0)

const bindData = computed(() => {
  const fmtList = field ? list.map(item => item[field]) : list
  const showList = fmtList.slice(0, showMax)
  const surplus = fmtList.slice(showMax)
  return {
    showList,
    count: surplus.length,
    tooltip: surplus.join(', '),
  }
})
</script>

<template>
  <div v-if="hasBindCount" class="flex gap-2">
    <RxTag v-for="item in bindData.showList" :key="item" :icon="icon" :label="item" :disabled="disabled" />
    <RxTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }" :label="`+${bindData.count}`" disabled />
  </div>
  <div class="select-none" v-else>
    <slot name="empty">
      --
    </slot>
  </div>
</template>

<style scoped></style>
