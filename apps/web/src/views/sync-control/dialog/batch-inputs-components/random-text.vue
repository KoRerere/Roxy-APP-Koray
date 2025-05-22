<script setup lang="ts">
import { RxInputNumber } from '/@/components/rx-input-number'

const formData = ref({
  min: 0,
  max: 10,
  /** 数据类型填 float , int  */
  data_type: 'int' as 'float' | 'int',
  /** 数据类型为float的时候，小数点的位数 */
  decimal_place_count: 1,
})


watch(() => formData.value.min, () => {
  if (formData.value.min >= formData.value.max) {
    formData.value.max = formData.value.min + 1
  }
})


watch(() => formData.value.max, () => {
  if (formData.value.max <= formData.value.min) {
    formData.value.max = formData.value.max + 1
  }
})

defineExpose({
  get formData() {
    const params = { ...formData.value }
    params.min = String(params.min)
    params.max = String(params.max)
    return params
  },
})
</script>

<template>
  <div class="random-text">
    <div class="form-item">
      <label class="form-item-label">{{ $t('数值类型') }}</label>
      <div class="form-item-content">
        <div class="flex flex-wrap gap-4">
          <div class="flex items-center gap-2">
            <RadioButton v-model="formData.data_type" input-id="int" name="type" value="int" />
            <label for="int">{{ $t('整数') }}</label>
          </div>
          <div class="flex items-center gap-2">
            <RadioButton v-model="formData.data_type" input-id="float" name="type" value="float" />
            <label for="float">{{ $t('小数') }}</label>
          </div>
        </div>
      </div>
    </div>
    <div v-if="formData.data_type === 'float'" class="form-item">
      <label class="form-item-label">{{ $t('小数点后位数') }}</label>
      <div class="form-item-content">
        <RxInputNumber v-model="formData.decimal_place_count" :max="10" :min="1" class="!w-120px" />
      </div>
    </div>
    <div class="form-item">
      <label class="form-item-label">{{ $t('数字范围') }}</label>
      <div class="form-item-content">
        <div class="input-number-row">
          <InputNumber v-model="formData.min" :use-grouping="false" fluid size="small" />
          <div class="gap-line" />
          <InputNumber v-model="formData.max" :use-grouping="false" fluid size="small" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.random-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  align-self: stretch;
}

.form-item {
  display: flex;
  align-items: center;
  gap: 16px;

  .form-item-label {
    flex-shrink: 0;
    width: 120px;
    color: var(--colors-text-text-primary, #fafafa);

    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 32px;
  }
}

.input-number-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;

  :deep(.p-inputtext) {
    width: 90px;
  }

  .gap-line {
    flex-shrink: 0;
    width: 10px;
    height: 1px;
    background: var(--Colors-Border-border-container, #c7cdd1);
  }
}
</style>
