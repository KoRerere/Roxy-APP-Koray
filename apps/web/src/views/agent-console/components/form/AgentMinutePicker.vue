<script setup lang="ts">
import DatePicker from 'primevue/datepicker'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  disabled?: boolean
}>()

const minute = defineModel<number>({ required: true })
const attrs = useAttrs()

const minuteDate = computed<Date>({
  get() {
    const normalizedMinute = Number.isInteger(minute.value) && minute.value >= 0 && minute.value <= 59
      ? minute.value
      : 0
    return new Date(2000, 0, 1, 0, normalizedMinute, 0, 0)
  },
  set(value) {
    const nextMinute = value.getMinutes()
    minute.value = Number.isInteger(nextMinute) && nextMinute >= 0 && nextMinute <= 59
      ? nextMinute
      : 0
  },
})

const formattedMinute = computed(() => String(minuteDate.value.getMinutes()).padStart(2, '0'))
</script>

<template>
  <span v-bind="attrs" class="agent-minute-picker" :class="{ disabled: props.disabled }">
    <DatePicker
      v-model="minuteDate"
      class="agent-minute-picker__datepicker"
      panel-class="agent-schedule-datepicker-panel agent-minute-datepicker-panel"
      time-only
      hour-format="24"
      show-icon
      icon-display="input"
      fluid
      :aria-label="$t('每小时执行分钟')"
      :disabled="props.disabled"
      :manual-input="false"
      :pt="{
        hourPicker: { style: 'display: none' },
        separatorContainer: { style: 'display: none' },
      }"
    >
      <template #inputicon="slotProps">
        <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="slotProps.class" @click.stop="slotProps.clickCallback" />
      </template>
    </DatePicker>
    <span class="agent-minute-picker__value" aria-hidden="true">{{ formattedMinute }}</span>
  </span>
</template>

<style lang="scss" scoped>
.agent-minute-picker {
  position: relative;
  display: inline-flex;
  height: 32px;
}

.agent-minute-picker__datepicker {
  width: 100%;
  height: 32px;

  :deep(.p-datepicker-input) {
    width: 100%;
    height: 32px;
    padding: 5px 28px 5px 10px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 10px;
    caret-color: transparent;
    color: transparent !important;
    background: var(--color-bg-primary);
    box-shadow: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;

    &:focus {
      border-color: var(--color-border-primary-inverse);
    }
  }

  :deep(.p-datepicker-input-icon-container) {
    right: 10px;
    left: auto;
  }
}

.agent-minute-picker__value {
  position: absolute;
  top: 50%;
  left: 10px;
  overflow: hidden;
  max-width: calc(100% - 38px);
  pointer-events: none;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  transform: translateY(-50%);
  white-space: nowrap;
}

.agent-minute-picker.disabled .agent-minute-picker__value {
  color: var(--color-text-disabled);
}

:global(.agent-minute-datepicker-panel .p-datepicker-time-picker) {
  min-width: 104px;
  padding: 12px 24px;
  border-top: 0;
}
</style>
