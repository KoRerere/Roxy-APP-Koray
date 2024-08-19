<script setup lang="ts">
const props = defineProps({
  operation: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['more'])

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))
</script>

<template>
  <div class="flex items-center">
    <div class="quick">
      <span v-for="item in quickOperation" :key="item.name" class="cursor-pointer mdi" :class="[item.icon]"
        size="small" />
    </div>

    <Button text size="small" @click.stop="$emit('more', $event)">
      <span class="mdi mdi-dots-horizontal" />
    </Button>
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
    display: flex;
    padding: var(--spacing-sm, 4px);
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    font-size: 16px;
  }
}
</style>
