<script setup lang="ts">
import { useTieredMenu } from '/@/hooks/useTieredMenu'

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

const [show] = useTieredMenu()

function openMenu(even: Event) {
  show(even, {})
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
      <span class="mdi mdi-dots-horizontal" />
    </Button>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-btn + .ant-btn) {
  margin-left: 8px;
}
</style>
