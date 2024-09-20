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
  <div v-for="item in filters" :key="item.key" class="flex items-center">
    <MultiSelect v-if="item.type === 'multiple'" v-model="item.value" class="mw-150" option-label="label"
      option-value="value" :max-selected-labels="1" :show-toggle-all="false" v-bind="item" @hide="handleFilterChange" />
    <Select v-else-if="item.type === 'select'" v-model="item.value" class="mw-150" show-clear checkmark
      :highlight-on-select="false" option-label="label" option-value="value" v-bind="item"
      @change="handleFilterChange" />

    <DatePicker v-else-if="item.type === 'date'" v-model="item.value" class="mw-150 flex-row-reverse"
      selection-mode="range" :manual-input="false" show-icon show-button-bar date-format="yy/mm/dd"
      :placeholder="item.placeholder" @hide="handleFilterChange" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-select-label),
:deep(.p-multiselect-label),
:deep(.p-inputtext) {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
  color: var(--Component-Colors-TextInput-text-text, #171c1f);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.mw-150 {
  min-width: 150px;
}

:deep(.p-datepicker:has(.p-datepicker-dropdown) .p-datepicker-input) {
  border-top-left-radius: 0;
  border-top-right-radius: var(--p-inputtext-border-radius);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: var(--p-inputtext-border-radius);
  // border-left: none;
}

:deep(.p-datepicker-dropdown) {
  width: auto;
  border-right: none;
  border-left: 1px solid var(--p-datepicker-dropdown-border-color);
  border-top-left-radius: var(--p-inputtext-border-radius);
  border-top-right-radius: 0;
  border-bottom-left-radius: var(--p-inputtext-border-radius);
  border-bottom-right-radius: 0;
  background: #fff;
}
</style>
