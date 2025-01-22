<script setup lang="ts">
import { type PreferenceSettings } from '/@/views/sync-control/model';
import { RxSvgIcon } from '/@/components/rx-icon/'

const formData = defineModel<PreferenceSettings['simulate']>({ required: true });

watch(() => formData.value.inputIntervalMinMs, () => {
  if (formData.value.inputIntervalMinMs >= formData.value.inputIntervalMaxMs) {
    formData.value.inputIntervalMaxMs = formData.value.inputIntervalMinMs + 1;
  }
})

watch(() => formData.value.inputIntervalMaxMs, () => {
  if (formData.value.inputIntervalMaxMs <= formData.value.inputIntervalMinMs) {
    formData.value.inputIntervalMinMs = Math.max(0, formData.value.inputIntervalMaxMs - 1);
  }
})

watch(() => formData.value.clickIntervalMinMs, () => {
  if (formData.value.clickIntervalMinMs >= formData.value.clickIntervalMaxMs) {
    formData.value.clickIntervalMaxMs = formData.value.clickIntervalMinMs + 1;
  }
})

watch(() => formData.value.clickIntervalMaxMs, () => {
  if (formData.value.clickIntervalMaxMs <= formData.value.clickIntervalMinMs) {
    formData.value.clickIntervalMinMs = Math.max(0, formData.value.clickIntervalMaxMs - 1);
  }
})
</script>

<template>
  <div class="simulate-settings">
    <div class="form-item">
      <label class="form-item-label">{{ $t('点击延迟') }}</label>
      <div class="form-item-content">
        <ToggleSwitch v-model="formData.enableClickDelay" />
      </div>
    </div>
    <div v-if="formData.enableClickDelay" class="form-item">
      <label class="form-item-label">{{ $t('点击延迟间隔') }}</label>
      <div class="form-item-content">
        <div class="input-number-row">
          <IconField class="w-[92px]">
            <InputNumber v-model="formData.clickIntervalMinMs" :min="0" :useGrouping="false" fluid size="small" />
            <InputIcon> ms </InputIcon>
          </IconField>
          <div class="divider" />
          <IconField class="w-[92px]">
            <InputNumber v-model="formData.clickIntervalMaxMs" :min="1" :useGrouping="false" fluid size="small" />
            <InputIcon> ms </InputIcon>
          </IconField>
        </div>
      </div>
    </div>
    <div class="form-item">
      <label class="form-item-label">{{ $t('输入延迟') }}</label>
      <div class="form-item-content">
        <ToggleSwitch v-model="formData.enableInputDelay" />
      </div>
    </div>
    <div v-if="formData.enableInputDelay" class="form-item">
      <label class="form-item-label">{{ $t('字符输入间隔') }}</label>
      <div class="form-item-content">
        <div class="input-number-row">
          <IconField class="w-[92px]">
            <InputNumber v-model="formData.inputIntervalMinMs" :min="0" :useGrouping="false" fluid size="small" />
            <InputIcon> ms </InputIcon>
          </IconField>
          <div class="divider" />
          <IconField class="w-[92px]">
            <InputNumber v-model="formData.inputIntervalMaxMs" :min="1" :useGrouping="false" fluid size="small" />
            <InputIcon> ms </InputIcon>
          </IconField>
        </div>
      </div>
    </div>
    <div class="form-item">
      <label class="form-item-label">{{ $t('延迟模式') }}</label>
      <div class="form-item-content">
        <RadioButtonGroup v-model="formData.clickDelayMode" name="ingredient" class="flex flex-wrap gap-4">
          <div class="flex items-center gap-2">
            <RadioButton input-id="parallel-delay" :value="1" size="small" />
            <label for="parallel-delay">{{ $t('并行延迟') }}</label>
            <RxSvgIcon v-tooltip.top="{ value: $t('并行延迟模式下，所有窗口同步执行延迟间隔'), showDelay: 500 }" class="align-middle ml-1"
              name="base/rx_ic_info" :size="12" color="#C7CDD1" />
          </div>
          <div class="flex items-center gap-2">
            <RadioButton input-id="serialization-delay" :value="0" size="small" />
            <label for="serialization-delay">{{ $t('串行延迟') }}</label>
            <RxSvgIcon v-tooltip.top="{ value: $t('串行延迟模式下，窗口逐个依次执行延迟间隔'), showDelay: 500 }" class="align-middle ml-1"
              name="base/rx_ic_info" :size="12" color="#C7CDD1" />
          </div>
        </RadioButtonGroup>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.checkbox-list {
  display: flex;
  align-items: center;
  gap: 24px;

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
  }
}

.divider {
  width: 10px;
  height: 1px;
  background: var(--Colors-Border-border-container, #C7CDD1);
}

.input-number-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;

  :deep(.p-inputtext) {
    padding-right: 28px;
  }
}

.form-item-label {
  min-width: 100px;
}
</style>
