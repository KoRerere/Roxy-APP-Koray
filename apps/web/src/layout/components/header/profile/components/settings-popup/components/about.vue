<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useConfirm } from 'primevue/useconfirm'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user';
import { useToast } from 'primevue/usetoast';

defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const confirm = useConfirm()
const toast = useToast()

function formatClientBtnLabel(item: ResourceUpdateMessage) {
  switch (item.status) {
    case 'downloading':
      return `${$t('正在下载')} ${Math.floor(item.percent)}%`;
    case 'downloaded':
      switch (item.type) {
        case 'app':
          return $t('升级并重启');
        case 'web':
          return $t('立即更新');
      }
      break;
    case 'failed':
      return $t('重试');
    default:
      return $t('下载');
  }
}

function showAppUpdaterDialog(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('正在下载')
  }
  if (item.status === 'downloaded') {
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

function handleClientItemClick(item: ResourceUpdateMessage) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.type === 'app') {
    showAppUpdaterDialog(info)
  }
  else if (info.type === 'web') {
    window.electronAPI.send('app:quitAndInstall', info)
  }
}

async function handleCheckUpdate(item: ResourceUpdateMessage) {
  if (item.type === 'app') {
    const result = await electronAPI.send('app:checkForUpdates')
    console.log('handleCheckUpdate app', result)
    if (result) {
      if (result.version === item.currentVersion) {
        toast.add({
          severity: 'success',
          summary: $t('当前版本已是最新'),
          life: 3000
        })
      } else {
        toast.add({
          severity: 'info',
          summary: $t('有新版本可用'),
          life: 3000
        })
      }
    }
  }
  else if (item.type === 'web') {
    const result = await electronAPI.send('app:checkWebForUpdates')
    console.log('handleCheckUpdate web', result)
  }
}
</script>

<template>
  <div class="app-updater">
    <template v-for="item in upgradeList" :key="item.releaseTime">
      <div class="upgrade-container">
        <div class="upgrade-header">
          <div class="upgrade-title">
            <RxSvgIcon name="base/logo" size="48px" class="mr-[6px] flex-shrink-0" />
            <div class="flex flex-col justify-between h-[40px]">
              <div class="flex h-[18px]">
                {{ item.title }}
                <template v-if="item.version !== item.currentVersion">
                  {{ item.version }}
                  <span class="new-badge"> New </span>
                </template>
              </div>
              <span class="version">{{ $t('当前版本:') }} {{ item.currentVersion }}</span>
            </div>
          </div>
          <template v-if="item.version === item.currentVersion">
            <RxButton severity="secondary" outlined size="xxs" :label="$t('检查更新')" @click="handleCheckUpdate(item)" />
          </template>
          <template v-else-if="item.releaseTime">
            <span class="release-time">{{ item.releaseTime?.split(' ')[0] }}</span>
          </template>
        </div>
        <div v-if="item.version !== item.currentVersion">
          <roxy-rich-text :html="item?.upgradeContent" class="feature-content" />
          <RxButton type="button" size="sm" :label="formatClientBtnLabel(item)"
            :icon="`base/${item.status === 'downloaded' ? 'rx_ic_renew' : 'rx_ic_download'}`"
            :loading="item.status === 'downloading'" class="mt-[6px]" @click="handleClientItemClick(item)" />
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
  padding: var(--spacing-2xl, 16px) 0px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
  border-bottom: 0.5px solid var(--colors-border-border-inactive, #e4e8eb);
}

.upgrade-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
}

.upgrade-title {
  display: flex;
  align-items: center;
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;

  .version {
    color: var(--colors-text-text-inactive, #7D8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
  }

  .new-badge {
    margin-left: 8px;
    display: inline-flex;
    padding: 2px 4px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border-radius: var(--radius-full, 9999px);
    background: var(--primitives-red-500, #F53838);
    color: var(--component-button-primary-text, #FFF);
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }
}

.release-time {
  color: var(--colors-text-text-tertiary, #575D60);
  text-align: right;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.feature-content {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
