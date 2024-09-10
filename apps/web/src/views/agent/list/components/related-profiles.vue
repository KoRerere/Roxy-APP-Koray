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
  return {
    value: props.data?.bindList![0],
    count: (props.data?.bindCount ?? 0) - 1,
  }
})
</script>

<template>
  <div v-if="hasBindCount">
    <ryTag>{{ bindData.value }}</ryTag>
    <ryTag v-if="bindData.count">
      {{ bindData.count }}
    </ryTag>
  </div>
  <div v-else>
    --
  </div>
</template>

<style scoped></style>
