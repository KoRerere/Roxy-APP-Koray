<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon/'
import { useWorkspaceStore } from '/@/stores/workspace'

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
})

const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3)

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
    tooltip: `other profiles: ${surplus?.join(', ')}`,
  }
})
</script>

<template>
  <div v-if="hasBindCount" class="flex gap-2">
    <RyTag v-for="item in bindData.list" :key="item" class="!text-3" :icon="icon" :value="`${workspaceName}-${item}`" />
    <RyTag v-if="bindData.count" v-tooltip.top="{ value: bindData.tooltip, showDelay: 500 }" class="!text-3" :value="`+${bindData.count}`" />
  </div>
  <div v-else>
    --
  </div>
</template>

<style scoped></style>
