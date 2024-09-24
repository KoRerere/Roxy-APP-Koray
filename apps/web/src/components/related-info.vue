<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon/'
import ryTag from '/@/components/ry-tag'

const props = defineProps({
  list: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  showMax: {
    type: Number as PropType<number>,
    default: 1,
  },
  icon: {
    type: String as PropType<SvgNames>,
  },
})

const hasBindCount = computed(() => {
  return (props.list?.length ?? 0) > 0
})

const bindData = computed(() => {
  const list = props.list?.slice(0, props.showMax)
  const surplus = props.list?.slice(props.showMax)

  return {
    list,
    count: surplus?.length,
    tooltip: `profiles id: ${surplus?.join(', ')}`,
  }
})
</script>

<template>
  <div v-if="hasBindCount" class="flex gap-2">
    <ryTag v-for="item in bindData.list" :key="item" :icon="icon" :value="item" />
    <ryTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }"
      :value="`+${bindData.count}`" />
  </div>
  <div v-else>
    --
  </div>
</template>

<style scoped></style>
