<script setup lang="ts">
const formData = ref({
  /** 主控窗口颜色 */
  mainControlColor: '#12A3FC',
  /** 是否同步键盘 */
  enableSyncKeybord: true,
  // 是否同步鼠标点击
  enableSyncMouseClick: true,
  // 是否同步鼠标轨迹
  enableSyncMouseMove: true,
  // 是否同步鼠标滚动
  enableSyncMouseScroll: true,
  // 输入延迟最小值
  inputIntervalMinMs: 100,
  // 输入延迟最大值
  inputIntervalMaxMs: 300,
  // 点击延迟最小值
  clickIntervalMinMs: 100,
  // 点击延迟最大值
  clickIntervalMaxMs: 300,
  // 点击延迟模式：0 串行， 1 并行
  clickDelayMode: 0,
})
</script>

<template>
  <div class="base-settings">
    <div class="form-item">
      <label class="form-item-label">{{ $t('主控窗口颜色') }}</label>
      <div class="form-item-content">
        <input v-model="formData.mainControlColor" type="color">
      </div>
    </div>
    <div class="group">
      <div class="group-title">
        {{ $t('同步设置') }}
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('同步键盘输入') }}</label>
        <div class="form-item-content">
          <ToggleSwitch v-model="formData.enableSyncKeybord" size="small" />
        </div>
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('同步鼠标输入') }}</label>
        <div class="form-item-content">
          <div class="checkbox-list">
            <div class="checkbox-item">
              <Checkbox v-model="formData.enableSyncMouseClick" binary size="small" input-id="enableSyncMouseClick" />
              <label for="enableSyncMouseClick">{{ $t('点击') }}</label>
            </div>
            <div class="checkbox-item">
              <Checkbox v-model="formData.enableSyncMouseScroll" binary size="small" input-id="enableSyncMouseScroll" />
              <label for="enableSyncMouseScroll">{{ $t('滚动') }}</label>
            </div>
            <div class="checkbox-item">
              <Checkbox v-model="formData.enableSyncMouseMove" binary size="small" input-id="enableSyncMouseMove" />
              <label for="enableSyncMouseMove">{{ $t('轨迹') }}</label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="group">
      <div class="group-title">
        {{ $t('仿真输入') }}
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('字符输入间隔') }}</label>
        <div class="form-item-content">
          <div class="input-number-row">
            <IconField class="w-[92px]">
              <InputText id="number" v-model="formData.inputIntervalMinMs" v-keyfilter.num fluid size="small" />
              <InputIcon> ms </InputIcon>
            </IconField>
            <div class="divider" />
            <IconField class="w-[92px]">
              <InputText id="number" v-model="formData.inputIntervalMaxMs" v-keyfilter.num fluid size="small" />
              <InputIcon> ms </InputIcon>
            </IconField>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('点击延迟间隔') }}</label>
        <div class="form-item-content">
          <div class="input-number-row">
            <IconField class="w-[92px]">
              <InputText id="number" v-model="formData.clickIntervalMinMs" v-keyfilter.num fluid size="small" />
              <InputIcon> ms </InputIcon>
            </IconField>
            <div class="divider" />
            <IconField class="w-[92px]">
              <InputText id="number" v-model="formData.clickIntervalMaxMs" v-keyfilter.num fluid size="small" />
              <InputIcon> ms </InputIcon>
            </IconField>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-item-label">{{ $t('点击延迟模式') }}</label>
        <div class="form-item-content">
          <RadioButtonGroup v-model="formData.clickDelayMode" name="ingredient" class="flex flex-wrap gap-4">
            <div class="flex items-center gap-2">
              <RadioButton input-id="serialization-delay" :value="0" size="small" />
              <label for="serialization-delay">串行延迟</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton input-id="parallel-delay" :value="1" size="small" />
              <label for="parallel-delay">并行延迟</label>
            </div>
          </RadioButtonGroup>
        </div>
      </div>
    </div>
    <RxButton class="save-button">
      {{ $t('保存并生效') }}
    </RxButton>
  </div>
</template>

<style lang="scss" scoped>
.base-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--oversize-spacing-2rem, 32px);

  .group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2xl, 16px);

    .group-title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: 'PingFang SC';
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: 20px;
    }
  }

  .form-item {
    display: flex;
    align-items: center;
    gap: 16px;

    .form-item-label {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: 'PingFang SC';
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 32px;

      &::after {
        content: ':';
      }
    }

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

    .input-number-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg, 8px);
      align-self: stretch;
    }

    .divider {
      width: 10px;
      height: 1px;
      background: var(--Colors-Border-border-container, #c7cdd1);
    }
  }
}

.save-button {
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
}
</style>
