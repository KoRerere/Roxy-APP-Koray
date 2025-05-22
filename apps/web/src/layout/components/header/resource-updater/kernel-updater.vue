<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const toast = useToast();
const confirm = useConfirm();

const collapsedMap = ref<Recordable<boolean>>({})

function formatKernelBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return $t('下载完成')
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('下载')
  }
}

function handleKernelItemClick(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('正在下载')
  } else if (item.coreVersion) {
    window.electronAPI.send('app:download-chrome-core', item.coreVersion)
  }
}

function handleCollapsed(item: ResourceUpdateMessage) {
  console.log('handleCollapsed', item)
  collapsedMap.value[item.coreVersion] = !collapsedMap.value[item.coreVersion]
}

const handleRemove = (event: MouseEvent, item: ResourceUpdateMessage) => {
  if (item.status !== 'downloaded') {
    return
  }

  confirm.require({
    target: event.currentTarget,
    message: $t('确定删除该内核吗？'),
    group: 'popup',
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
      onClick: (e: MouseEvent) => e.stopPropagation()
    },
    acceptProps: {
      label: $t('确定'),
      severity: 'danger',
      onClick: (e: MouseEvent) => e.stopPropagation()
    },
    accept: async () => {
      try {
        await window.electronAPI.send('app:delete-chrome-core', item.coreVersion)
        item.status = 'uninstalled'
        toast.add({ severity: 'success', summary: $t('删除成功'), life: 2500 });
      } catch (error) {
        console.error('error', error)
        toast.add({ severity: 'error', summary: error || $t('删除失败'), life: 2500 });
      }
    },
  });
};
</script>

<template>
  <div class="kernel-updater">
    <template v-for="item in upgradeList" :key="item.releaseTime">
      <div class="updater-item" :class="{ collapsed: collapsedMap[item.coreVersion] }">
        <div class="updater-header">
          <div class="updater-header-left">
            <img src="/kernel-logo.png" class="w-[32px] h-[32px] ">
            <div class="updater-title">
              RoxyChrome {{ item.coreVersion }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <RxButton severity="secondary" outlined size="xxs" :label="formatKernelBtnLabel(item)"
              :icon="`base/${item.status === 'downloaded' ? 'rx_ic_check' : 'rx_ic_download'}`"
              :loading="item.status === 'downloading'" :disabled="item.status === 'downloaded'"
              @click="handleKernelItemClick(item)" />
            <div class="flex-cc cursor-pointer" @click="handleRemove($event, item)">
              <RxSvgIcon name="base/rx_ic_bin_1" class="remove-icon"
                :class="{ 'disabled': item.status !== 'downloaded' }" />
            </div>
          </div>
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

  .remove-icon {
    cursor: pointer;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
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
  color: var(--colors-text-text-primary, #fafafa);
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
