<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import './rich-text/'
import { useConfirm } from 'primevue/useconfirm'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'

defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const confirm = useConfirm()
const userStore = useUserStore()
const { currentLocale } = useSimpleLocale()

function formatClientBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return $t('升级并重启')
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('下载')
  }
}

function handleClientItemClick(item: ResourceUpdateMessage) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.status === 'downloading') {
    return $t('正在下载')
  }
  else if (info.status === 'downloaded') {
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
        window.electronAPI.send('app:quitAndInstall', info)
      },
    })
  }
  else if (info.status === 'failed') {
    window.electronAPI.send('app:checkForUpdates')
  }
  else {
    // window.electronAPI.send('app:download-update', info)
  }
}
</script>

<template>
  <div class="app-updater">
    <template v-if="upgradeList.length">
      <template v-for="item in upgradeList" :key="item.releaseTime">
        <div class="upgrade-container">
          <div class="upgrade-header">
            <div class="upgrade-title">
              <RxSvgIcon name="base/logo" size="32px" class="mr-[6px] flex-shrink-0" />
              <span>{{ item.version }} {{ item.upgradeTitle }} </span>
            </div>
            <span class="release-time">{{ item.releaseTime?.split(' ')[0] }}</span>
          </div>
          <div class="pl-[56px]">
            <rich-text :html="item.originUpgradeData?.[ currentLocale === 'zh-CN' ? 'upgradeContent' : 'upgradeContentEn']" />
            <RxButton type="button" size="sm" :label="formatClientBtnLabel(item)" icon="base/rx_ic_download" :loading="item.status === 'downloading'" class="mt-[6px]"
                      @click="handleClientItemClick(item)"
            />
          </div>
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
.app-updater {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}

.upgrade-container {
  width: 100%;
  display: flex;
  padding: var(--spacing-xl, 12px) 0px var(--spacing-4xl, 24px) 0px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
  border-bottom: 0.5px solid var(--Colors-Border-border-inactive, #e4e8eb);
}

.upgrade-header {
  width: 100%;
  display: flex;
  padding: 0px var(--spacing-2xl, 16px);
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
}

.upgrade-title {
  display: flex;
  align-items: center;
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
}

.release-time {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  text-align: right;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.feature-content {
  padding-left: 57px;
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
        color: #000;
        text-align: center;
        font-family: 'JetBrains Mono';
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }

      .tips {
        color: var(--Colors-Text-text-tertiary, #7c8387);
        text-align: center;
        font-family: Inter;
        font-size: 10px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }
    }
  }
}
</style>
