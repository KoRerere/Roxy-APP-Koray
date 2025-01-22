<script setup lang="ts">
import RxTagColorCheckbox from '/@/components/rx-tag-color-checkbox/index.vue'
import { type PreferenceSettings } from '/@/views/sync-control/model';

const colorOptions = ['#FF12A3FC', '#FFEB5757', '#FFD17CFE', '#FFFBC26F', '#C7CDD1'].map((color) => {
  // #FF12A3FC => #12A3FCFF 颜色要求为8位
  return color.at(0) + color.slice(3) + color.slice(1, 3)
})

const formData = defineModel<PreferenceSettings['base']>({ required: true });
</script>

<template>
  <div class="base-settings">
    <div class="form-item">
      <label class="form-item-label">{{ $t('主控窗口颜色') }}</label>
      <div class="form-item-content">
        <RxTagColorCheckbox v-model="formData.mainControlWindowColor" :colorOptions="colorOptions" />
      </div>
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
</template>

<style lang="scss" scoped>
.group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2xl, 16px);
  margin-top: 6px;

  .group-title {
    color: var(--Colors-Text-text-primary, #171c1f);

    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
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

.form-item-label {
  min-width: 100px;
}
</style>
