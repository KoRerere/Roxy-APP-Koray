<script setup lang="ts">
import ryButton from './ry-button'

const props = defineProps({
  operation: {
    type: Array,
    default: () => [],
  },
  showMenu: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['more'])

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))
</script>

<template>
  <div class="flex items-center">
    <div class="quick">
      <span v-for="item in quickOperation" :key="item.name" class="quick-item cursor-pointer" :class="[item.icon]"
        @click.stop="() => item.onClick?.()" />
    </div>
    <ryButton v-if="showMenu" text size="small" @click.stop="$emit('more', [$event, operation])">
      <span class="mdi mdi-dots-horizontal" />
    </ryButton>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-btn + .ant-btn) {
  margin-left: 8px;
}

.quick {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);

  &-item {
    &:active {
      color: orange;
    }
  }
}
</style>
