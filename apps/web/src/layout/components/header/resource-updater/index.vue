<script setup lang="tsx">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { onMounted, ref, useTemplateRef } from 'vue'

import AppForceUpgradeModal from './app-force-upgrade-modal.vue'
import AppUpdater from './app-updater.vue'
import KernelUpdater from './kernel-updater.vue'
import { useToast } from 'primevue/usetoast'
import { debounce } from 'es-toolkit'
import { I18nT } from 'vue-i18n'
import { useSimpleLocale } from '/@/stores/locale'
import type { KernelUpdateItem } from './kernel-utils'
import {
  clearKernelRead,
  isKernelRead,
  matchKernelItem,
  normalizeCoreType,
  sortKernelList,
} from './kernel-utils'
import { CoreType } from '/@/enums/'

interface KernelUpdateGroup {
  title: string
  list: KernelUpdateItem[]
}

const simpleLocale = useSimpleLocale()
const toast = useToast()
const popoverRef = useTemplateRef('popover')
const btnRef = useTemplateRef('btn')
const tabComponentRef = ref()
const isPopoverVisible = ref(false)
const clientUpdates = ref<ResourceUpdateMessage[]>([])
/** 全量内核列表（Chrome + Firefox），以 coreType + coreVersion 唯一标识 */
const kernelUpdates = ref<ResourceUpdateMessage[]>([])
/** 分组后的内核列表，供 KernelUpdater 渲染 */
const kernelUpdateGroup = ref<KernelUpdateGroup[]>([])

const tabs = ref([
  {
    title: $t('客户端升级'),
    list: clientUpdates,
    value: 'client',
    badge: computed(() => clientUpdates.value.length),
    component: markRaw(AppUpdater),
  },
  {
    title: $t('内核升级'),
    list: kernelUpdateGroup,
    value: 'kernel',
    badge: computed(() => kernelUpdateGroup.value[0]?.list.filter(item => item._light).length),
    component: markRaw(KernelUpdater),
  },
])
const tabModel = ref(tabs.value[0]!.value)
const isDownloadingKernel = ref(false)

const noticeNum = computed(() => {
  return clientUpdates.value.length + (kernelUpdateGroup.value[0]?.list.filter(item => item._light).length ?? 0)
})

const isDownloading = computed(() => {
  return [...clientUpdates.value, ...kernelUpdates.value].some(item => item.status === 'downloading')
})

// APP 是否强制升级
const isForceUpgrade = computed(() => {
  const isAppForceUpgrade = clientUpdates.value.some(item => item.type === 'app' && item.status === 'downloaded' && item.originUpgradeData?.forceUpgrade)
  const isWebForceUpgrade = clientUpdates.value.some(item => item.type === 'web' && item.status === 'downloaded' && item.newFeatureTips?.activityInfo?.[simpleLocale.currentLocale!]?.imageList?.length > 0 && item.newFeatureTips?.isActivity)
  return isAppForceUpgrade || isWebForceUpgrade
})

// APP 更新信息
const updateInfo = computed(() => {
  // APP 升级优先级高于 web 升级
  return clientUpdates.value.find(item => item.type === 'app') || clientUpdates.value.find(item => item.type === 'web')
})

async function checkForUpdates() {
  globalThis.electronAPI.send('app:checkForUpdates')
}

function toggle(event: Event) {
  popoverRef.value?.instance?.toggle(event)
  if (isPopoverVisible.value) {
    tabs.value.some((tab) => {
      if (tab.badge) {
        tabModel.value = tab.value
        return true
      }
      return tab.badge
    })
  }
  checkForUpdates()
}

watch(isPopoverVisible, (visible) => {
  console.debug('isPopoverVisible', visible)
  if (visible) {
    globalThis.electronAPI.send('app:reGetUpdateInfo', 'kernel', CoreType.Chrome)
    globalThis.electronAPI.send('app:reGetUpdateInfo', 'kernel', CoreType.Firefox)
  }
})

onMounted(() => {
  getKernelList()
  checkForUpdates()
})

globalThis.electronAPI.on('app:core-list-update', getKernelList)

async function getKernelList() {
  const list = await globalThis.electronAPI.send('app:getCoreList')
  // 将后端拉取的列表同步到 kernelUpdates，正在下载的条目保留本地状态
  list.forEach((item) => {
    // 必须同时匹配 coreType 和 coreVersion，避免 Chrome/Firefox 同版本互相覆盖
    const idx = kernelUpdates.value.findIndex(i => matchKernelItem(i, item))
    if (idx === -1) {
      kernelUpdates.value.push(item)
    }
    else if (kernelUpdates.value[idx].status !== 'downloading') {
      // 非下载中状态可以用后端数据覆盖，保持状态最新
      kernelUpdates.value[idx] = { ...kernelUpdates.value[idx], ...item }
    }
  })
  kernelUpdates.value = sortKernelList(kernelUpdates.value)
  genKernelGroup(toRaw(kernelUpdates.value))
}

/** 将内核列表分为「新内容」和「内核列表」两组，每种 coreType 各自独立提示新版本 */
function genKernelGroup(list: ResourceUpdateMessage[]) {
  const defaults: KernelUpdateGroup[] = [
    {
      title: $t('新内容'),
      list: [],
    },
    {
      title: $t('内核列表'),
      list: [],
    },
  ]

  // 记录每种内核类型（Chrome / Firefox）各自的最新条目，用于"新版本"提示
  const firstByCoreType = new Set<string>()

  kernelUpdateGroup.value = sortKernelList(list).reduce((acc, item) => {
    const coreType = normalizeCoreType(item.coreType)
    const isFirst = !firstByCoreType.has(coreType)
    if (isFirst) {
      firstByCoreType.add(coreType)
    }

    if (isFirst && !['update', 'downloaded'].includes(item.status!) && !isKernelRead(item)) {
      acc[0]!.list.push({ ...item, _light: true, _desc: $t('新版本') })
    }
    else if (item.status === 'update' && !isKernelRead(item)) {
      acc[0]!.list.push({ ...item, _light: true, _desc: $t('有新的更新可用') })
    }
    else {
      acc[1]!.list.push(item)
    }
    return acc
  }, defaults).filter(item => item.list.length > 0)
}

function updateKernelStatus(data: ResourceUpdateMessage) {
  // 增量更新分组视图中的单条状态，避免整表重渲染
  const item = kernelUpdateGroup.value.flatMap(item => item.list).find(item => matchKernelItem(item, data))
  if (item) {
    Object.assign(item, data)
  }
}

// 5 分钟内不重复提示
let lastTime = 0

watch(isDownloadingKernel, () => {
  if (Date.now() - lastTime < 60000 * 5) {
    return
  }
  if (isDownloadingKernel.value && !isPopoverVisible.value) {
    btnRef.value?.btnEl.click()
    lastTime = Date.now()
    nextTick(() => {
      tabModel.value = tabs.value[1]!.value
      isDownloadingKernel.value = false
      tabComponentRef.value?.[1].focusKernel()// 内核过多，展开时滚动到下载中的位置
    })
  }
})

function onDownloadClick(item: ResourceUpdateMessage) {
  console.log('onDownloadClick', item)
  lastTime = Date.now()
}

const showDownloadError = debounce((data: ResourceUpdateMessage) => {
  toast.add({
    severity: 'error',
    summary: (() => (
      <I18nT keypath={data.description || $t('获取内核失败，{tech}', { tech: '{tech}' })}>
        {{ tech: () => <a class="cursor-pointer" onClick={showLiveChat}>{$t('联系技术支持')}</a> }}
      </I18nT>
    )) as any,
  })
}, 100)

globalThis.electronAPI.on('app:resource-update', (data) => {
  // 内核升级
  if (data.type === 'kernel') {
    if (data.status === 'failed') {
      showDownloadError(data)
    }

    const index = kernelUpdates.value.findIndex(item => matchKernelItem(item, data))
    if (index === -1) {
      kernelUpdates.value.push(data)
      kernelUpdates.value = sortKernelList(kernelUpdates.value)
      genKernelGroup(toRaw(kernelUpdates.value))
    }
    else {
      kernelUpdates.value[index] = data
      updateKernelStatus(data)
    }

    if (data.status === 'downloaded') {
      // 下载完成后清除已读标记，使该内核重新出现在「新内容」分组
      clearKernelRead(data)
      genKernelGroup(toRaw(kernelUpdates.value))
    }

    isDownloadingKernel.value = data.status === 'downloading' && !data.silent
  }
  // 客户端升级(app、web、patch)
  else {
    const index = clientUpdates.value.findIndex(item => data.type === item.type)
    if (index === -1) {
      clientUpdates.value.push(data)
    }
    else {
      clientUpdates.value[index] = data
    }

    // 有 app 更新就不展示 web 资源更新
    if (clientUpdates.value.length > 1 && clientUpdates.value.some(data => data.type === 'app')) {
      clientUpdates.value = clientUpdates.value.filter(data => data.type === 'app')
    }
  }
})
</script>

<template>
  <AppForceUpgradeModal :is-force-upgrade="isForceUpgrade" :update-info="updateInfo" />

  <div v-tooltip.left="{ value: $t('更新'), showDelay: 600 }" class="flex justify-center" :data-force-upgrade="isForceUpgrade" :data-update-info="updateInfo">
    <OverlayBadge :value="noticeNum" severity="danger" size="small" :class="{ 'no-message': !noticeNum }">
      <RxButton ref="btn" severity="secondary" outlined size="xs" @click="toggle">
        <template #icon>
          <SvgIcon :name="isDownloading ? 'base/rx_ic_upgrade' : 'base/rx_ic_upgrade'" size="17" color="var(--colors-icon-icon-secondary)" />
        </template>
      </RxButton>
    </OverlayBadge>

    <RyPopover ref="popover" :class="popup.content" @show="isPopoverVisible = true" @hide="isPopoverVisible = false">
      <div class="header">
        <div class="title">
          {{ $t('更新') }}
        </div>
      </div>
      <Tabs v-model:value="tabModel">
        <TabList :pt="{ tablist: 'px-4 gap-4 h-[40px] !border-[var(--colors-border-border-subtle)]', activeBar: '!h-[2px]' }">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value" class="flex flex-1 justify-center items-center gap-1.5">
            {{ tab.title }}
            <Badge v-if="tab.badge" :value="tab.badge" severity="danger" size="small" />
          </Tab>
        </TabList>
        <TabPanels class="!pa-0 min-h-[100px] max-h-[280px] overflow-auto">
          <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value" class="overflow-hidden">
            <component :is="tab.component" ref="tabComponentRef" :upgrade-list="(tab.list as any)" @on-download-click="onDownloadClick" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </RyPopover>
  </div>
</template>

<style lang="scss" module="popup">
.content {
  width: 384px;

  :global(.header) {
    display: flex;
    padding: var(--spacing-sm, 4px);
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;
  }

  :global(.title) {
    display: flex;
    padding: var(--spacing-sm, 4px) var(--spacing-xl, 12px);
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 24px;
    /* 171.429% */
  }
}
</style>

<style lang="scss" scoped>
.no-message {
  :deep(.p-badge) {
    display: none;
  }
}
</style>
