<template>
  <Transition>
    <div ref="menuRef" v-show="visible" class="ctx-menu" :style="_style">
      <a-menu>
        <a-menu-item v-for="item in props.operation" :key="item.name" @click="() => item.handler(props.record)">{{
          item.name }}</a-menu-item>
      </a-menu>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import useOutside from '/@/hooks/outside';
const props = defineProps({
  mouseEvent: {
    type: Object as PropType<MouseEvent>,
  },
  operation: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  record: {
    type: Object as PropType<object>,
    default: () => ({})
  }
})

const _style = computed(() => ({
  top: `${props.mouseEvent?.clientY || 0}px`,
  left: `${props.mouseEvent?.clientX || 0}px`,
}))

const menuRef = ref<null | HTMLElement>(null)
const isClickOutside = useOutside(menuRef)
const visible = ref(false)

const unwatch = watch(isClickOutside, (value) => {
  if (value) {
    visible.value = false
  }
})

onMounted(() => {
  visible.value = true
})

onUnmounted(() => {
  unwatch()
})
</script>

<style lang="scss" scoped>
.ctx-menu {
  position: absolute;
  z-index: 1000;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;

}

.v-enter-active,
.v-leave-active {
  transition: all 0.1s linear;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  transform: scale(0);
  transform-origin: top left;
}
</style>