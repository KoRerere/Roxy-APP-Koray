<script setup lang="ts">
defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  operation: {
    type: Array as PropType<Array<any>>,
    // required: true,
  },
  operationHandler: {
    type: Function,
    default: () => () => { },
  },
})

const ryCtxMenu = ref()

function getRef() {
  return ryCtxMenu.value
}

defineExpose({
  getRef,
})
</script>

<template>
  <ContextMenu ref="ryCtxMenu" :model="operation">
    <template #item="{ item, props }">
      <a v-ripple v-bind="props.action" @click="() => operationHandler(item, data)">
        <span :class="item.icon" />
        <span>{{ item.name }}</span>
      </a>
    </template>
  </ContextMenu>
</template>

<style scoped></style>
