<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import InputDate from '/@/components/ry-form/input-date.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'

defineProps({
  filters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emit = defineEmits(['change'])

const multiChanged = ref(false)
const _date = ref([])

function onMultiChange() {
  multiChanged.value = true
}

function onMultiHide() {
  if (!multiChanged.value)
    return

  multiChanged.value = false
  onFilterChange()
}

function onDateClear() {
  onFilterChange()
}

function onDateChange(value: any) {
  _date.value = value
}

function onDateHide() {
  if (_date.value?.length && _date.value.some((item: any) => !!item)) {
    emit('change')
    _date.value = []
  }
}

function onFilterChange() {
  emit('change')
}
</script>

<template>
  <div class="flex items-start gap-2">
    <template v-for="item in filters" :key="item.name">
      <MultiSelect v-if="item.type === 'multiple'" v-model="item.value" class="min-w-40" option-label="label" option-value="value" :max-selected-labels="1" :show-toggle-all="false" v-bind="item.props"
        @change="onMultiChange" @hide="onMultiHide">
        <template #dropdownicon>
          <RxSvgIcon name="base/rx_ic_chevron_down" />
        </template>
      </MultiSelect>
      <RxInputSelect v-else-if="item.type === 'select'" v-model="item.value" :name="item.name" size="xxs" option-value="value" checkmark :filter="false" :highlight-on-select="false"
        v-bind="item.props" @change="onFilterChange" />
      <InputDate v-else-if="item.type === 'date'" v-model="item.value" class="min-w-40 flex-row-reverse" selection-mode="range" :manual-input="false" show-icon show-button-bar date-format="yy/mm/dd"
        v-bind="item.props" @hide="onDateHide" @update:modelValue="onDateChange" @clear-click="onDateClear" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-select-label),
:deep(.p-multiselect-label),
:deep(.p-inputtext) {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

:deep(.p-datepicker:has(.p-datepicker-dropdown) .p-datepicker-input) {
  border-top-left-radius: 0;
  border-top-right-radius: var(--p-inputtext-border-radius);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: var(--p-inputtext-border-radius);
}

:deep(.p-datepicker-dropdown) {
  width: auto;
  border-right: none;
  border-left: 1px solid var(--p-datepicker-dropdown-border-color);
  border-top-left-radius: var(--p-inputtext-border-radius);
  border-top-right-radius: 0;
  border-bottom-left-radius: var(--p-inputtext-border-radius);
  border-bottom-right-radius: 0;
  background: var(--colors-background-bg-action);
}
</style>
