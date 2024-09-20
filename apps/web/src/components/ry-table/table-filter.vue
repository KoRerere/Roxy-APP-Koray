<script setup lang="ts">
import { getFormData } from '/@/utils'

const props = defineProps({
  filters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['change'])

function handleFilterChange() {
  emits('change', getFormData(props.filters))
}
</script>

<template>
  <div v-for="item in filters" :key="item.key">
    <MultiSelect v-if="item.type === 'multiple'" v-model="item.value" class="select" option-label="label"
      option-value="value" :max-selected-labels="1" :show-toggle-all="false" v-bind="item" @hide="handleFilterChange" />

    <Select v-else v-model="item.value" class="select" show-clear checkmark :highlight-on-select="false"
      option-label="label" option-value="value" v-bind="item" @change="handleFilterChange">
      <!-- <template #dropdownicon>
      </template> -->
    </Select>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-select-label),
:deep(.p-multiselect-label) {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
  color: var(--Component-Colors-TextInput-text-text, #171c1f);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

// :deep(.p-select-dropdown) {
//   width: auto;
//   margin-left: var(--spacing-md, 6px);
// }

.select {
  min-width: 150px;
}
</style>
