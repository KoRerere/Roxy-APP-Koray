<script setup lang="ts">
defineProps({
  filters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['change'])

function handleFilterChange(item: any) {
  const { key, value } = item
  emits('change', { [key]: value })
}
</script>

<template>
  <Select v-for="item in filters" :key="item.key" v-model="item.value" class=" min-w[150px]" :options="item.options"
    :placeholder="item.placeholder" show-clear checkmark :highlight-on-select="false" option-label="name"
    option-value="value" @change="handleFilterChange(item)" />
</template>

<style lang="scss" scoped>
:deep(.p-select-label) {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
}
</style>
