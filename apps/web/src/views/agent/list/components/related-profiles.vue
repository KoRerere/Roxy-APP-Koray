<script setup lang="ts">
import type { ProxyItem } from '../operation'
import ryTag from '/@/components/ry-tag'

const props = defineProps({
  data: {
    type: Object as PropType<ProxyItem>,
    default: undefined,
  },
})

const hasBindCount = computed(() => {
  return (props.data?.bindCount ?? 0) > 0
})

const bindData = computed(() => {
  const surplus = props.data?.bindList?.slice(1)

  return {
    value: props.data?.bindList![0],
    count: surplus?.length,
    tooltip: `profiles id: ${surplus?.join(', ')}`,
  }
})
</script>

<template>
  <div v-if="hasBindCount" class="flex gap-2">
    <ryTag>{{ bindData.value }}</ryTag>
    <ryTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }">
      +{{ bindData.count }}
    </ryTag>
  </div>
  <div v-else>
    --
  </div>
</template>

<style scoped></style>
