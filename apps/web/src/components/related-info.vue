<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon/'

const props = defineProps({
  field: {
    type: String as PropType<string>,
    default: '',
  },
  list: {
    type: Array as PropType<{ [key: string]: any }[]>,
    default: undefined,
  },
  showMax: {
    type: Number as PropType<number>,
    default: 1,
  },
  icon: {
    type: String as PropType<SvgNames>,
  },
  disabled: {
    type: Boolean as PropType<boolean>,
    default: true,
  },
})

const hasBindCount = computed(() => {
  return (props.list?.length ?? 0) > 0
})

const bindData = computed(() => {
  const _list = props.field
    ? props.list?.map(item => item[props.field])
    : props.list
  const list = _list?.slice(0, props.showMax)
  const surplus = _list?.slice(props.showMax)
  return {
    list,
    count: surplus?.length,
    tooltip: surplus?.join(', '),
  }
})
</script>

<template>
  <div v-if="hasBindCount" class="flex gap-2">
    <RxTag v-for="item in bindData.list" :key="item" :icon="icon" :label="item" :disabled="disabled" />
    <RxTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }" :label="`+${bindData.count}`" disabled />
  </div>
  <div v-else>
    <slot name="empty">
      --
    </slot>
  </div>
</template>

<style scoped></style>
