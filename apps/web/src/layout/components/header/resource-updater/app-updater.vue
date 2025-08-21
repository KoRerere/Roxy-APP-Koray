<script setup lang="ts">
import MotionArrow from '/@/layout/components/header/resource-updater/motion-arrow.vue';
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import './rich-text/'
import { useConfirm } from 'primevue/useconfirm'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'

defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const confirm = useConfirm()
const userStore = useUserStore()

function formatClientBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent!)}%`
  }
  else if (item.status === 'downloaded') {
    if (item.type === 'app') {
      return $t('重启并安装')
    }
    else if (item.type === 'web') {
      return $t('刷新')
    }
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('下载 v{version}', { version: item.version })
  }
}

function showAppUpdaterDialog(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('正在下载')
  }
  else if (item.status === 'downloaded') {
    confirm.require({
      message: $t('所有窗口将被关闭，您的工作将被保存。'),
      header: $t('你确认要重启并安装新版本吗？'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('重启'),
      },
      accept: () => {
        window.electronAPI.send('app:quitAndInstall', item)
      },
    })
  }
  else if (item.status === 'failed') {
    window.electronAPI.send('app:checkForUpdates')
  }
  else {
    // window.electronAPI.send('app:download-update', info)
  }
}

async function handleClientItemClick(item: ResourceUpdateMessage) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.type === 'app') {
    showAppUpdaterDialog(info)
  }
  else if (info.type === 'web') {
    await window.electronAPI.send('app:quitAndInstall', info)
  }
}
</script>

<template>
  <div class="flex flex-col items-start self-stretch gap-3 min-h-65">
    <template v-if="upgradeList.length">
      <template v-for="item in upgradeList" :key="item.releaseTime">
        <div v-if="item.type === 'app'" class="w-full flex flex-col items-center gap-6 pa-6 app">
          <MotionArrow class="mx-auto"></MotionArrow>
          <div class="flex flex-col gap-1.5">
            <div class="app-title">{{ $t('有新的更新可用') }}</div>
            <div class="app-desc">{{ $t('最新版本 v{version} 已发布，请更新客户端以保持稳定性并享受最新功能。', { version: item.version }) }}</div>
          </div>
          <RxButton v-if="item.status === 'downloaded'" class="w-full" size="md" icon="base/rx_ic_renew" :label="formatClientBtnLabel(item)" @click="handleClientItemClick(item)"></RxButton>
          <RxButton v-else class="w-full" size="md" outlined severity="secondary" icon="base/rx_ic_download" :label="formatClientBtnLabel(item)" :loading="item.status === 'downloading'"
            @click="handleClientItemClick(item)"></RxButton>
        </div>
        <div v-if="item.type === 'web'" class="w-full flex items-start gap-2.5 px-4 py-3 patch">
          <RxSvgIcon class="flex-shrink-0" name="base/rx_ic_patch" color="var(--colors-icon-icon-brand)" />
          <div class="flex-1 flex flex-col gap-1">
            <div class="patch-title">{{ $t('v{version} 补丁', { version: item.version }) }}</div>
            <div class="patch-version">{{ $t('点击刷新以应用更新补丁') }}</div>
          </div>
          <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_refresh" :label="formatClientBtnLabel(item)" :loading="item.status === 'downloading'"
            @click="handleClientItemClick(item)"></RxButton>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="client-no-data">
        <div class="box">
          <RxSvgIcon name="base/logo" class="w-[48px] h-[48px]" />
          <div class="content">
            <div class="version">
              v{{ userStore.appVersion }}
            </div>
            <div class="tips">
              {{ $t('您的客户端已是最新版本') }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.app {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 16px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 18px;
  }
}

.patch {
  border-bottom: 1px solid var(--component-dropdown-divider, #E2E9EE);

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: 16px;
  }

  &-version {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }
}

.client-no-data {
  display: flex;
  height: 270px;
  padding: var(--spacing-xl, 96px) 112px var(--spacing-4xl, 96px) 112px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xl, 0px);
  align-self: stretch;

  .box {
    display: flex;
    width: 160px;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2xl, 16px);

    .content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm, 4px);
      align-self: stretch;

      .version {
        color: var(--colors-text-text-primary, #FAFAFA);
        text-align: center;
        font-family: 'JetBrains Mono';
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }

      .tips {
        color: var(--colors-text-text-tertiary, #575D60);
        text-align: center;
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: 16px;
      }
    }
  }
}
</style>
