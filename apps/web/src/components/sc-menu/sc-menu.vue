<script lang="ts" setup>
const props = defineProps({
  operation: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  data: {
    type: Object as PropType<object>,
    default: () => ({}),
  },
  operationHandler: {
    type: Function,
    default: () => () => { },
  },
  position: {
    type: Object,
    default: () => ({}),
  },
})

const _style = computed(() => {
  return {
    top: `${props.position.y || 0}px`,
    left: `${props.position.x || 0}px`,
  }
})

const visible = ref(false)

function menuClick(event: any) {
  props.operationHandler(event)
  visible.value = false
}

onMounted(() => {
  visible.value = true
})
</script>

<template>
  <a-dropdown v-model:open="visible" :trigger="['contextmenu']">
    <span class="mark" :style="_style" />
    <template #overlay>
      <a-menu @click="menuClick">
        <a-menu-item v-for="item in props.operation" :key="item.key" :icon="item.icon">
          {{
            item.name }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style>
.mark {
  position: absolute;
  z-index: -1;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  opacity: 0;
  background-color: transparent;
}
</style>
