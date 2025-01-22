<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';

function closeWindow() {
  electronAPI.send('syncControl:close');
}

function showPreferences() {
  electronAPI.send('syncControl:openPreferencesDialog');
}
</script>

<template>
  <div class="header">
    <div class="title">
      <span class="production-name">RoxyBrowser</span>
      <span class="sub-title">{{ $t('窗口同步') }}</span>
    </div>
    <div class="actions">
      <div v-if="false" class="action-item" @click="showPreferences">
        <RxSvgIcon name="base/rx_ic_gear" />
        <span class="text">{{ $t('设置') }}</span>
      </div>
      <div v-if="false" class="action-item">
        <RxSvgIcon name="base/rx_ic_info_line" />
        <span class="text">{{ $t('帮助') }}</span>
      </div>
      <div v-if="false" class="split-line"></div>
      <RxButton icon="base/rx_ic_delete" size="xxs" variant="text" class="no-drag" @click="closeWindow" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-drag {
  -webkit-app-region: no-drag;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  -webkit-app-region: drag;

  .title {
    .production-name {
      color: #fff;
      font-family: Archivo;
      font-size: 16px;
      font-style: normal;
      font-weight: 700;
      line-height: 20px;
      margin-right: 6px;
    }

    .sub-title {
      color: var(--Colors-Alpha-alpha-white-60, rgba(255, 255, 255, 0.6));
      font-family: Inter;
      font-size: 16px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl, 12px);
    color: white;

    .action-item {
      display: flex;
      min-width: 56px;
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: var(--spacing-sm, 4px);
      -webkit-app-region: no-drag;
      cursor: pointer;

      .text {
        color: var(--Component-Colors-Buttons-Secondary-text, #FFF);
        text-align: center;
        font-family: Inter;
        font-size: var(--Font-Size-text-sm, 12px);
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
      }
    }

    .split-line {
      width: 1px;
      height: 16px;
      background: var(--Colors-Border-border-strong-hover, #7C8387);
    }
  }
}
</style>
