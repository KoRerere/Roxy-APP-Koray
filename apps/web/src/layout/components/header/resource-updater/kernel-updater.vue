<script setup lang="ts">
import { $t } from '/@/locales'
import { useConfirm } from 'primevue/useconfirm';
import { useResponseToast } from "/@/hooks/useResponseToast";
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { SvgNames } from '/@/components/rx-icon'
import { safeParseJSON } from '/@/utils';
import { RxAlert } from '/@/components/rx-alert'

type KernelUpdateItem = ResourceUpdateMessage & {
  _light?: boolean
  _desc?: string
}

const { upgradeList } = defineProps<{
  upgradeList: {
    title: string
    list: KernelUpdateItem[]
  }[]
}>()

const emit = defineEmits(['onDownloadClick'])

const confirm = useConfirm();
const [_, onlyErrorToast] = useResponseToast()
const popoverRef = useTemplateRef('popover')

function formatKernelBtnLabel(item: KernelUpdateItem) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent!)}%`
  }
  else if (item.status === 'downloaded') {
    return $t('下载完成')
  }
  else if (item.status === 'update') {
    return $t('更新')
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('下载')
  }
}

function formatKernelIcon(item: KernelUpdateItem) {

  const iconMap: Recordable<SvgNames> = {
    'downloading': 'base/rx_ic_download',
    'downloaded': 'base/rx_ic_check',
    'update': 'base/rx_ic_renew'
  }

  return iconMap[item.status as keyof typeof iconMap] || 'base/rx_ic_download'
}

async function handleKernelItemClick(event: MouseEvent, item: KernelUpdateItem) {
  const usingCores = await window.electronAPI.send('browser:usingCores')

  if (usingCores.includes(item.coreVersion!)) {
    popoverRef.value?.instance?.show(event, event.target)
    return
  }

  if (item.status === 'downloading') {
    return $t('正在下载')
  } else if (item.coreVersion) {
    window.electronAPI.send('app:download-chrome-core', item.coreVersion)
    emit('onDownloadClick', item)
  }
}

const handleRemove = (event: MouseEvent, item: KernelUpdateItem) => {
  confirm.require({
    target: event.currentTarget as HTMLElement,
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
        await window.electronAPI.send('app:delete-chrome-core', item.coreVersion!)
        item.status = 'uninstalled'
      } catch (error) {
        console.error('error', error)
        onlyErrorToast(-1, $t('删除失败'))
      }
    },
  })
}

const onRead = (item: KernelUpdateItem) => {
  item._light = false
  const readMap = safeParseJSON(localStorage.getItem('kernel-read-map') || '{}')
  readMap[item.coreVersion!] = true
  localStorage.setItem('kernel-read-map', JSON.stringify(readMap))
}

defineExpose({
  focusKernel() {
    const coreVersion = upgradeList[1]?.list.find(item => item.status === 'downloading')?.coreVersion
    if (coreVersion) {
      document.getElementById(`kernel_${coreVersion}`)?.scrollIntoView({ behavior: 'smooth' });
    }
  }
})
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <div class="w-full" v-for="upgrade in upgradeList" :key="upgrade.title">
      <div v-if="upgradeList?.length > 1" class="py-3 px-4 title">{{ upgrade.title }}</div>
      <div :id="`kernel_${item.coreVersion}`" v-for="item in upgrade.list" :key="item.releaseTime" class="w-full flex flex-col items-start item" :class="{ 'light': item._light }">
        <div class="w-full flex justify-between items-center self-stretch">
          <div class="flex-1 flex items-center gap-1.5 py-3 pl-4" @click="onRead(item)">
            <div class="relative">
              <img class="block w-8 h-8" src="/kernel-logo.png">
              <div v-if="item._light" class="absolute top-0 right-0 w-2 h-2 bg-red rounded-full"></div>
            </div>
            <div>
              <div class="version">{{ `RoxyChrome ${item.coreVersion}` }}</div>
              <div v-if="item._desc" class="mt-0.5 desc">{{ item._desc }}</div>
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-2 pr-4">
            <RxButton severity="secondary" outlined size="xxs" :label="formatKernelBtnLabel(item)" :icon="formatKernelIcon(item)" :loading="item.status === 'downloading'"
              :disabled="item.status === 'downloaded'" @click="handleKernelItemClick($event, item)" />
            <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_bin_1" :disabled="!['downloaded', 'update'].includes(item.status!)" @click="handleRemove($event, item)">
            </RxButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <RyPopover ref="popover">
    <RxAlert type="warn" :title="$t('更新内核前请先关闭窗口。')"></RxAlert>
  </RyPopover>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: normal;
}

.item {
  border-bottom: 0.5px solid var(--component-dropdown-divider);

  &.light {
    border-bottom: 0.5px solid var(--component-table-border-selected);
    background: var(--component-table-bg-selected);

    .desc {
      color: var(--colors-text-text-brand);
    }
  }
}

.version {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: normal;
}
</style>
