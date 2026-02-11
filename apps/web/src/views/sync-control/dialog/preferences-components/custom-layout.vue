<template>
  <div class="custom-layout">
    <div v-if="false" class="form-item">
      <label class="form-item-label">{{ $t('显示器') }}</label>
      <div class="form-item-content">
        <Select v-model="formData.monitor_index" :options="monitorOptions" optionLabel="name" optionValue="code"
          class="w-full md:w-56" />
      </div>
    </div>
    <div v-if="false" class="form-item">
      <label class="form-item-label">{{ $t('布局') }}</label>
      <div class="form-item-content">
        <RadioButtonGroup v-model="formData.type" name="ingredient" class="flex flex-wrap gap-4">
          <template v-for="option in layoutRadioOptions" :key="option.value">
            <div class="flex items-center gap-2">
              <RadioButton input-id="serialization-delay" :value="option.value" />
              <label for="serialization-delay">{{ option.label }}</label>
            </div>
          </template>
        </RadioButtonGroup>
      </div>
    </div>
    <template v-if="formData.type === 'custom'">
      <div v-if="false" class="split-line"></div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('窗口大小') }}</label>
        <div class="form-item-content">
          <div class="input-number-row">
            <IconField>
              <InputIcon class="prefix"> W </InputIcon>
              <InputNumber v-model="formData.w" fluid size="small" :min="0" :useGrouping="false"
                v-tooltip.top="$t('宽度')" />
            </IconField>
            <IconField>
              <InputIcon class="prefix"> H </InputIcon>
              <InputNumber v-model="formData.h" fluid size="small" :min="0" :useGrouping="false"
                v-tooltip.top="$t('高度')" />
            </IconField>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('窗口间距') }}</label>
        <div class="form-item-content">
          <div class="input-number-row">
            <IconField>
              <InputIcon class="prefix">
                <RxSvgIcon name="base/rx_ic_gap_h" size="14px" />
              </InputIcon>
              <InputNumber v-model="formData.gap_horizontal" :min="0" :useGrouping="false" fluid size="small"
                v-tooltip.top="$t('水平间距')" />
            </IconField>
            <IconField>
              <InputIcon class="prefix">
                <RxSvgIcon name="base/rx_ic_gap_v" size="14px" />
              </InputIcon>
              <InputNumber v-model="formData.gap_vertical" :min="0" :useGrouping="false" fluid size="small"
                v-tooltip.top="$t('垂直间距')" />
            </IconField>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('每行数量') }}</label>
        <div class="form-item-content flex items-center gap-[12px]">
          <InputNumber v-model="formData.count_per_row" class="!w-[120px]" :min="1" :max="1000" fluid size="small" />
          <span>{{ $t('个/每行') }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PreferenceSettings } from '../../model';
import { RxSvgIcon } from '/@/components/rx-icon';
;

const formData = defineModel<PreferenceSettings['customLayout']>({ required: true });

const layoutRadioOptions = ref([
  { label: $t('宫格'), value: 'grid' },
  { label: $t('堆叠'), value: 'stack' },
  { label: $t('自定义'), value: 'custom' }
]);

const monitorOptions = ref([]);

// globalThis.electronAPI.send('syncControl:getSyncStartResult').then((result) => {
//   if (result.monitors) {
//     // 扩展屏幕 (3840 x 2160)
//     monitorOptions.value = result.monitors.map((monitor) => ({
//       name: `${$t('扩展屏幕')} ${monitor.index + 1} (${monitor.width} x ${monitor.height})`,
//       code: monitor.index
//     }));
//   }
// });

globalThis.electronAPI.send('syncControl:getMainControlBrowserSize').then((result) => {
  formData.value.w ||= result?.width || 0;
  formData.value.h ||= result?.height || 0;
});
</script>

<style lang="scss" scoped>
.input-number-row {
  display: flex;
  align-items: center;
  gap: 16px;

  :deep(.p-inputicon) {
    line-height: 15px;

    &.prefix {
      position: absolute;
      left: 12px;
      z-index: 10;
    }
  }

  :deep(.p-inputtext) {
    padding-left: 32px;
  }
}

.form-item-label {
  min-width: 100px;
}
</style>
