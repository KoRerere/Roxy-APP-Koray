<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon/'

defineOptions({ inheritAttrs: false })

const { field, list, showMax = 1, disabled = true } = defineProps<{
  list: any[]
  icon?: SvgNames
  field?: string
  showMax?: number
  disabled?: boolean
}>()

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
  <div v-if="hasBindCount" class="flex gap-2" v-bind="$attrs">
    <RxTag v-for="item in bindData.showList" :key="item" :icon="icon" :label="item" :readonly="disabled" />
    <RxTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }" :label="`+${bindData.count}`" :readonly="disabled" />
  </div>
  <slot v-else name="empty">
    <div class="select-none" v-bind="$attrs">
      --
    </div>
  </slot>
</template>

<style scoped></style>
