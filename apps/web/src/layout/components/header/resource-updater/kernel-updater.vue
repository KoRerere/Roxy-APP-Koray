<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import FeatureContent from './feature-content.vue'

const props = defineProps<{
  upgradeList: ResourceUpdateMessage[]
  featureTitleList: any[]
}>()

function formatKernelBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('Downloading')} ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return $t('Installed')
  }
  else if (item.status === 'failed') {
    return $t('Retry')
  }
  else {
    return $t('Install')
  }
}

function handleKernelItemClick(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('Downloading')
  }
  else if (item.status === 'uninstalled' && item.coreVersion) {
    window.electronAPI.send('app:download-chrome-core', item.coreVersion)
  }
}

function handleCollapsed(item: ResourceUpdateMessage) {
  item.collapsed = !item.collapsed
}
</script>

<template>
  <div class="kernel-updater">
    <template v-for="item in upgradeList" :key="item.releaseTime">
      <div class="updater-item">
        <div class="updater-header">
          <div class="updater-header-left">
            <RxSvgIcon :name="item.collapsed ? 'base/rx_ic_chevron_down' : 'base/rx_ic_chevron_right'" class="cursor-pointer" @click="handleCollapsed(item)" />
            <img src="/kernel-logo.png" class="w-[32px] h-[32px] mr-[6px]">
            <div class="updater-title">
              {{ item.title }} {{ item.coreVersion }}
            </div>
          </div>
          <Button
            type="button"
            severity="secondary"
            size="small"
            :label="formatKernelBtnLabel(item)"
            :icon="`pi ${item.status === 'downloaded' ? 'pi-check' : 'pi-download'}`"
            :loading="item.status === 'downloading'"
            :disabled="item.status === 'downloaded'"
            @click="handleKernelItemClick(item)"
          />
        </div>
        <FeatureContent :feature-title-list="featureTitleList" :updater-item="item" class="updater-content" :class="{ collapsed: item.collapsed }" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.kernel-updater {
  display: flex;
  padding: var(--spacing-xl, 12px) 0px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
}

.updater-item {
  display: flex;
  padding: var(--spacing-xl, 12px) 0px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  border-bottom: 0.5px solid var(--Color-blue-200, #7eccfc);
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

  &.collapsed {
    max-height: 300px;
  }
}
</style>
