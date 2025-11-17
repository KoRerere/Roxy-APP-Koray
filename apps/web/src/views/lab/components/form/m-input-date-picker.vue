<script setup lang="ts">
import type { DatePickerProps } from 'primevue/datepicker';

interface Props extends /* @vue-ignore */ Omit<DatePickerProps, 'size' | 'dateFormat' | 'showIcon' | 'iconDisplay' | 'showButtonBar' | 'manualInput'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  dateFormat?: string
  showIcon?: boolean
  iconDisplay?: 'input' | 'button' | (string & {})
  showButtonBar?: boolean
  manualInput?: boolean
}

const {
  size = 'sm',
  dateFormat = 'yy/mm/dd',
  showIcon = true,
  iconDisplay = 'input',
  showButtonBar = true,
  manualInput = false,
} = defineProps<Props>()

</script>

<template>
  <DatePicker :class="size" :dateFormat :showIcon :iconDisplay :showButtonBar :manualInput>
    <template #inputicon="props">
      <SvgIcon name="base/rx_ic_calendar" :class="props.class" @click.stop="props.clickCallback"></SvgIcon>
    </template>
  </DatePicker>
</template>

<style lang="scss" scoped>
.xxs {
  --picker-padding: 4px 6px;
  --picker-padding-start: 6px;
  --picker-border-width: 0.5px;
  --picker-radius: 4px;
  --picker-font-size: 12px;
  --picker-line-height: 16px;
}

.xs {
  --picker-padding: 6px;
  --picker-padding-start: 6px;
  --picker-border-width: 0.5px;
  --picker-radius: 4px;
  --picker-font-size: 12px;
  --picker-line-height: 16px;
}

.sm {
  --picker-padding: 6px 8px;
  --picker-padding-start: 8px;
  --picker-border-width: 1px;
  --picker-radius: 6px;
  --picker-font-size: 12px;
  --picker-line-height: 20px;
}

.md {
  --picker-padding: 8px 10px;
  --picker-padding-start: 10px;
  --picker-border-width: 1px;
  --picker-radius: 6px;
  --picker-font-size: 13px;
  --picker-line-height: 20px;
}

.lg {
  --picker-padding: 10px 12px;
  --picker-padding-start: 12px;
  --picker-border-width: 1px;
  --picker-radius: 8px;
  --picker-font-size: 14px;
  --picker-line-height: 20px;
}

.p-datepicker:has(.p-datepicker-input-icon-container) {
  :deep(.p-datepicker-input) {
    padding-inline-start: calc((var(--picker-padding-start) * 2) + var(--icon-size));
    padding-inline-end: var(--picker-padding-start);
  }
}

:deep(.p-datepicker-input-icon-container) {
  inset-inline-start: var(--picker-padding-start);
  inset-inline-end: unset;
}

:deep(.p-datepicker-input) {
  padding: var(--picker-padding);
  border-width: var(--picker-border-width);
  border-radius: var(--picker-radius);
  font-size: var(--picker-font-size);
  line-height: var(--picker-line-height);
}
</style>
