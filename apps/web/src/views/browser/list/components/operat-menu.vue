<script setup lang="ts">
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  operation: {
    type: Array,
    default: () => [],
  },
})

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))
</script>

<template>
  <div>
    <Button v-for="item in quickOperation" :key="item.name" size="small" :icon="item.icon">
      {{ item.name }}
    </Button>

    <Button text size="small">
      <span class="mdi mdi-dots-horizontal" />
    </Button>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-btn + .ant-btn) {
  margin-left: 8px;
}
</style>
