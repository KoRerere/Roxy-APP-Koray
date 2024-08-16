<script setup lang="ts">
defineProps({
  filters: {
    type: Array,
    default: () => [],
  },
})

const _filters = ref([
  {
    key: 'city',
    name: '城市',
    placeholder: '请选择城市',
    value: null,
    options: [
      { label: '北京', value: 'bj' },
      { label: '上海', value: 'sh' },
      { label: '广州', value: 'gz' },
      { label: '深圳', value: 'sz' },
      { label: '杭州', value: 'hz' },
    ],
  },
  {
    key: 'order',
    name: '排序',
    placeholder: '请选择排序',
    value: null,
    options: [
      { label: '升序', value: 'NY' },
      { label: '降序', value: 'RM' },
    ],
  },
])
</script>

<template>
  <Select v-for="item in _filters" :key="item.key" v-model="item.value" :options="item.options"
          :placeholder="item.placeholder" option-label="label" option-value="value" checkmark :highlight-on-select="false"
  />
</template>

<style lang="scss" scoped>
:deep(.p-select-label) {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
}
</style>
