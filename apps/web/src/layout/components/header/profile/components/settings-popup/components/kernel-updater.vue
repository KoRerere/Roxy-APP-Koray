<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

const { coreList } = defineProps<{
  coreList: ResourceUpdateMessage[]
}>()


const toast = useToast();
const confirm = useConfirm();

const collapsedMap = ref<Recordable<boolean>>({})


function formatKernelBtnLabel(item: ResourceUpdateMessage) {
  switch (item.status) {
    case 'downloading':
      return `${$t('正在下载')} ${Math.floor(item.percent)}%`
    case 'downloaded':
      return $t('升级完成')
    case 'failed':
      return $t('重试')
    default:
      return $t('升级')
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
      outlined: true
    },
    acceptProps: {
      label: $t('确定'),
      severity: 'danger'
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
    <template v-for="item in coreList" :key="item.releaseTime">
      <div class="updater-item">
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
            <div class="flex-cc" @click="handleRemove($event, item)">
              <RxSvgIcon name="base/rx_ic_bin_1" class="remove-icon"
                :class="{ 'disabled': item.status !== 'downloaded' }" />
            </div>
          </div>
        </div>
        <div class="updater-content">
          <rich-text :html="item?.upgradeContent" />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.kernel-updater {
  width: 100%;
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
  border-bottom: 0.5px solid var(--colors-border-border-inactive, #e4e8eb);
}

.updater-header {
  width: 100%;
  display: flex;
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
  padding-left: 3px;
  overflow: hidden;
  color: var(--colors-text-text-tertiary, #575D60);
  text-overflow: ellipsis;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
