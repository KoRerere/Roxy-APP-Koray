<script setup lang="ts">
import RxTooltip from '/@/components/rx-tooltip'
import { RxAlert } from '/@/components/rx-alert'
import { useConfirm } from 'primevue/useconfirm'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { CoreType } from '/@/enums'
import type { SvgNames } from '/@/components/rx-icon'
import type { KernelUpdateItem } from './kernel-utils'
import {
  fetchUsingCoreVersions,
  formatKernelName,
  getKernelKey,
  isChromeCore,
  isFirefoxCore,
  isKernelInUse,
  markKernelAsRead,
} from './kernel-utils'
import { isString } from 'es-toolkit'
import RoxyChromeImg from '/@/assets/images/kernel/RoxyChrome.png'
import RoxyFirefoxImg from '/@/assets/images/kernel/RoxyFirefox.png'
import { useTutorialEntityLabels } from '/@/composables/useTutorialEntityLabels'

/** 内核类型筛选（UI 层），与 CoreType 枚举对应 */
enum KernelFilter {
  All = 'All',
  Chrome = 'Chrome',
  Firefox = 'Firefox',
}

const { upgradeList } = defineProps<{
  upgradeList: {
    title: string
    list: KernelUpdateItem[]
  }[]
}>()

const emit = defineEmits(['onDownloadClick'])

const confirm = useConfirm()
const [_, onlyErrorToast] = useResponseToast()
const popoverRef = useTemplateRef('popover')
const tutorialLabels = useTutorialEntityLabels()

const usingVersion = ref('')
const kernelInUseAlertTitle = computed(() => tutorialLabels.value.kernelInUseCloseEntities(usingVersion.value))
/** 当前筛选的内核类型：全部 / Chrome / Firefox */
const kernelType = ref(KernelFilter.All)

/** 根据筛选条件计算展示列表、各类型数量和可更新条目 */
const currentKernel = computed(() => {
  const available = upgradeList || []
  const flatList = available.flatMap(upgrade => upgrade.list)

  const chromeCount = flatList.filter(item => isChromeCore(item.coreType)).length
  const firefoxCount = flatList.filter(item => isFirefoxCore(item.coreType)).length

  const filteredAvailable = available.map(group => ({
    ...group,
    list: group.list.filter((item) => {
      if (kernelType.value === KernelFilter.All) {
        return true
      }
      if (kernelType.value === KernelFilter.Firefox) {
        return isFirefoxCore(item.coreType)
      }
      return isChromeCore(item.coreType)
    }),
  })).filter(group => group.list.length > 0)

  const filteredList = filteredAvailable.flatMap(g => g.list)
  const updateList = filteredList.filter(item => item.status === 'update')

  return {
    count: filteredList.length,
    chromeCount,
    firefoxCount,
    available: filteredAvailable,
    updateList,
  }
})

const kernelOptions = computed(() => {
  const { chromeCount, firefoxCount } = currentKernel.value

  return [
    {
      name: $t('全部'),
      value: KernelFilter.All,
      disabled: false,
    },
    {
      name: `Chrome${chromeCount > 0 ? `(${chromeCount})` : ''}`,
      value: KernelFilter.Chrome,
      disabled: false,
    },
    {
      name: `Firefox${firefoxCount > 0 ? `(${firefoxCount})` : ''}`,
      value: KernelFilter.Firefox,
      disabled: firefoxCount === 0,
    },
  ]
})

function formatKernelBtnLabel(item: KernelUpdateItem) {
  if (item.status === 'downloading') {
    if (item.percent >= 99) {
      return $t('安装中')
    }
    return `${$t('正在下载')} ${Math.floor(item.percent ?? 0)}%`
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
    downloading: 'base/rx_ic_spin',
    downloaded: 'base/rx_ic_check',
    update: 'base/rx_ic_renew',
  }

  return iconMap[item.status as keyof typeof iconMap] || 'base/rx_ic_download'
}

async function updateAllKernel(event: MouseEvent) {
  const usingCores = await fetchUsingCoreVersions()

  const _usingCores: string[] = []

  currentKernel.value.updateList.forEach((item) => {
    if (item.coreVersion) {
      if (!isKernelInUse(usingCores, item)) {
        // IPC 名称沿用历史命名，实际支持 Chrome 和 Firefox，通过 coreType 区分
        globalThis.electronAPI.send('app:download-chrome-core', item.coreVersion, item.coreType ?? CoreType.Chrome)
        emit('onDownloadClick', item)
      }
      else {
        _usingCores.push(formatKernelName(item.coreType, item.coreVersion))
      }
    }
  })

  if (_usingCores.length) {
    usingVersion.value = _usingCores.join(', ')
    popoverRef.value?.instance?.show(event, event.target)
  }
}

async function handleKernelItemClick(event: MouseEvent, item: KernelUpdateItem) {
  if (item.status === 'downloading') {
    if (item.coreVersion) {
      await globalThis.electronAPI.send('app:cancel-download-chrome-core', item.coreVersion, item.coreType ?? CoreType.Chrome)
    }
    return
  }

  const usingCores = await fetchUsingCoreVersions()

  if (isKernelInUse(usingCores, item)) {
    usingVersion.value = formatKernelName(item.coreType, item.coreVersion)
    popoverRef.value?.instance?.show(event, event.target)
    return
  }

  if (item.coreVersion) {
    globalThis.electronAPI.send('app:download-chrome-core', item.coreVersion, item.coreType ?? CoreType.Chrome)
    emit('onDownloadClick', item)
  }
}

function handleRemove(event: MouseEvent, item: KernelUpdateItem) {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    message: $t('确定删除该内核吗？'),
    group: 'popup',
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
      onClick: (e: MouseEvent) => e.stopPropagation(),
    },
    acceptProps: {
      label: $t('确定'),
      severity: 'danger',
      onClick: (e: MouseEvent) => e.stopPropagation(),
    },
    accept: async () => {
      try {
        await globalThis.electronAPI.send('app:delete-chrome-core', item.coreVersion!, item.coreType ?? CoreType.Chrome)
        item.status = 'uninstalled'
      }
      catch (error) {
        console.error('error', error)
        onlyErrorToast(-1, isString(error) ? error : $t('删除失败'))
      }
    },
  })
}

function onRead(item: KernelUpdateItem) {
  item._light = false
  markKernelAsRead(item)
}

defineExpose({
  /** 自动展开 popover 时，滚动到正在下载的内核条目 */
  focusKernel() {
    const downloadingItem = currentKernel.value.available
      .flatMap(group => group.list)
      .find(item => item.status === 'downloading')
    if (downloadingItem) {
      // id 使用组合键，避免 Chrome/Firefox 同版本冲突
      document.getElementById(`kernel_${getKernelKey(downloadingItem)}`)?.scrollIntoView({ behavior: 'smooth' })
    }
  },
})
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <div class="-mb-3 flex items-center justify-between pa-3 w-full">
      <RxSelectButton v-model="kernelType" :options="kernelOptions" option-disabled="disabled" option-label="name" option-value="value" data-key="value" :pt="{
        root: select.bg,
        pcToggleButton: {
          root: select.btn,
        },
      }"
      />
      <RxButton v-if="!!currentKernel.updateList.length" severity="secondary" variant="text" size="xxs" icon="base/rx_ic_renew" :label="$t('更新全部({count})', { count: currentKernel.updateList.length })"
                @click="updateAllKernel"
      />
    </div>
    <div v-for="upgrade in currentKernel.available" :key="upgrade.title" class="w-full">
      <div v-if="currentKernel.available.length > 1" class="py-2 px-4 title">
        {{ upgrade.title }}
      </div>
      <div v-for="item in upgrade.list" :id="`kernel_${getKernelKey(item)}`" :key="getKernelKey(item)" class="w-full flex flex-col items-start item" :class="{ 'cursor-pointer light': item._light }">
        <div class="w-full flex justify-between items-center self-stretch">
          <div class="flex-1 flex items-center gap-1.5 py-3 pl-4" @click="onRead(item)">
            <div class="relative">
              <img class="block w-8 h-8" :src="item.coreType === CoreType.Firefox ? RoxyFirefoxImg : RoxyChromeImg">
              <div v-if="item._light" class="absolute top-0 right-0 w-2 h-2 bg-red rounded-full" />
            </div>
            <div>
              <div class="version">
                {{ formatKernelName(item.coreType, item.coreVersion) }}
              </div>
              <div v-if="item._desc" class="mt-0.5 desc">
                {{ item._desc }}
              </div>
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-2 pr-4">
            <component :is="item.status === 'downloading' ? RxTooltip : 'div'" tooltip-content-class="py-1 px-2">
              <template #default>
                <RxButton :class="{ group: item.status === 'downloading' }" severity="secondary" variant="outlined" size="xxs" :disabled="item.status === 'downloaded'"
                          @click="handleKernelItemClick($event, item)"
                >
                  <SvgIcon class="group-hover:hidden" :class="{ 'loading-circle': item.status === 'downloading' }" :name="formatKernelIcon(item)" color="var(--colors-icon-icon-secondary)" />
                  <SvgIcon class="hidden group-hover:block" name="base/rx_ic_pause" color="var(--colors-icon-icon-secondary)" />
                  <span>{{ formatKernelBtnLabel(item) }}</span>
                </RxButton>
              </template>
              <template #content>
                <div class="text-3 font-600 text-white w-fit">
                  {{ $t('取消') }}
                </div>
              </template>
            </component>

            <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_bin_1" :disabled="!['downloaded', 'update'].includes(item.status!)" @click="handleRemove($event, item)" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <RyPopover ref="popover">
    <RxAlert type="warn" :title="kernelInUseAlertTitle" />
  </RyPopover>
</template>

<style lang="scss" module="select">
.bg {
  background: var(--component-skeleton-bg-overlay);
}

.btn {
  background: transparent !important;

  &:disabled {
    border-color: var(--togglebutton-border-color) !important;
  }
}
</style>

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
