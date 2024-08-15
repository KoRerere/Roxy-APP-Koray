<script setup lang="ts">
import ScMenu from '/@/components/sc-menu'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  operation: {
    type: Array,
    default: () => [],
  },
  operationHandler: {
    type: Function,
    default: () => () => { },
  },
})

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))

function quickClick(key: string) {
  props.operationHandler({ key }, props.data)
}

const scMenu = ScMenu()
const iconRef = ref<HTMLElement | null>(null)

function openMenu() {
  const { width, height, left, top } = iconRef.value!.getBoundingClientRect()
  scMenu.insert({
    operation: props.operation,
    operationHandler: (event: any) => props.operationHandler(event, props.data),
    position: { x: left + width * 1.5, y: top + height * 0.5 },
  })
}
</script>

<template>
  <div>
    <Button v-for="item in quickOperation" :key="item.name" size="small" :icon="item.icon"
            @click.stop="quickClick(item.key)"
    >
      {{ item.name }}
    </Button>

    <Button text size="small" @click.stop="openMenu">
      <span ref="iconRef" class="mdi mdi-dots-horizontal" />
    </Button>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-btn + .ant-btn) {
  margin-left: 8px;
}
</style>
