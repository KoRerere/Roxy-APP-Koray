<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';

const props = defineProps<{
  version?: string
  currentVersion?: string
}>()

const { version, currentVersion } = toRefs(props)

function handleClientItemClick() {
  window.electronAPI.send('app:quitAndInstall', { type: 'app' })
}
</script>

<template>
  <div class="app-updater-box">
    <div class="flex items-center gap-8px">
      <RxSvgIcon name="base/rx_ic_updates" color="var(--colors-icon-icon-info)" />
      <span class="title">{{ $t('有新版本可用') }}</span>
    </div>
    <div class="flex items-center sub-title">
      <i18n-t
        :keypath="$t('{click}v{version}（当前 v{currentVersion}）', { click: '{click}', version: '{version}', currentVersion: '{currentVersion}' })">
        <template #click>
          <span @click="handleClientItemClick" class="text-[var(--colors-text-text-link)]">
            {{ $t('点击更新') }}
          </span>
        </template>
        <template #version>
          {{ version }}
        </template>
        <template #currentVersion>
          {{ currentVersion }}
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-updater-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;

  .title {
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .sub-title {
    color: var(--colors-text-text-secondary, #34393D);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    /* 150% */
    padding-left: 24px;
  }
}
</style>
