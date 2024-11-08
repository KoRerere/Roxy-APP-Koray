<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const collapsedMap = ref<Recordable<boolean>>({})

function formatKernelBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return $t('升级完成')
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('升级')
  }
}

function handleKernelItemClick(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('正在下载')
  }
  else if (item.status === 'uninstalled' && item.coreVersion) {
    window.electronAPI.send('app:download-chrome-core', item.coreVersion)
  }
}

function handleCollapsed(item: ResourceUpdateMessage) {
  console.log('handleCollapsed', item)
  collapsedMap.value[item.coreVersion] = !collapsedMap.value[item.coreVersion]
}
</script>

<template>
  <div class="kernel-updater">
    <template v-for="item in upgradeList" :key="item.releaseTime">
      <div class="updater-item" :class="{ collapsed: collapsedMap[item.coreVersion] }">
        <div class="updater-header">
          <div class="updater-header-left">
            <RxSvgIcon :name="collapsedMap[item.coreVersion] ? 'base/rx_ic_chevron_down' : 'base/rx_ic_chevron_right'" class="cursor-pointer" @click="handleCollapsed(item)" />
            <img src="/kernel-logo.png" class="w-[32px] h-[32px] ">
            <div class="updater-title">
              RoxyChrome {{ item.coreVersion }}
            </div>
          </div>
          <RxButton severity="secondary" outlined size="xxs" :label="formatKernelBtnLabel(item)" :icon="`base/${item.status === 'downloaded' ? 'rx_ic_check' : 'rx_ic_download'}`"
                    :loading="item.status === 'downloading'" :disabled="item.status === 'downloaded'" @click="handleKernelItemClick(item)"
          />
        </div>
        <rich-text :html="item.upgradeContent" class="updater-content" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.kernel-updater {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.updater-item {
  width: 100%;
  display: flex;
  padding: var(--spacing-xl, 12px) 0px;
  flex-direction: column;
  align-items: flex-start;
  border-bottom: 0.5px solid var(--Colors-Border-border-inactive, #e4e8eb);
  background: var(--Color-neutrals-0, #fff);

  &.collapsed {
    gap: var(--spacing-xl, 12px);
    border-bottom: 0.5px solid var(--Color-blue-200, #7eccfc);
    background: var(--Color-blue-100, #e8f5fc);

    &:last-of-type {
      border-bottom: 0;
    }

    .updater-content {
      max-height: 300px;
    }
  }
}

.updater-header {
  width: 100%;
  display: flex;
  padding: 0px 16px;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
}

.updater-header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
}

.updater-title {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
}

.updater-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s;
  padding-left: 42px;
}
</style>
