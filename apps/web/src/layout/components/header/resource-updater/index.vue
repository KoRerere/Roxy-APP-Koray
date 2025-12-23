<script setup lang="tsx">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { onMounted, ref, useTemplateRef } from 'vue'
import { $t } from '/@/locales'
import AppForceUpgradeModal from './app-force-upgrade-modal.vue'
import AppUpdater from './app-updater.vue'
import KernelUpdater from './kernel-updater.vue'
import { useToast } from 'primevue/usetoast'
import { debounce } from 'es-toolkit'
import { I18nT } from 'vue-i18n'
import { safeParseJSON } from '/@/utils'
import { useSimpleLocale } from '/@/stores/locale'

interface KernelUpdateGroup {
  title: string
  list: (ResourceUpdateMessage & { _light?: boolean, _desc?: string })[]
}

const simpleLocale = useSimpleLocale()
const toast = useToast()
const popoverRef = useTemplateRef('popover')
const btnRef = useTemplateRef('btn')
const tabComponentRef = ref()
const clientUpdates = ref<ResourceUpdateMessage[]>([])
const kernelUpdates = ref<ResourceUpdateMessage[]>([])
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
const tabModel = ref(tabs.value[0].value)
const isDownloadingKernel = ref(false)

const noticeNum = computed(() => {
  return clientUpdates.value.length + kernelUpdateGroup.value[0]?.list.filter(item => item._light).length
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
  electronAPI.send('app:checkForUpdates')
  electronAPI.send('app:checkWebForUpdates')
}

function toggle(event: Event) {
  popoverRef.value?.instance?.toggle(event)
  if (popoverRef.value?.instance?.visible) {
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

onMounted(() => {
  getKernelList()
  checkForUpdates()
})

electronAPI.on('app:core-list-update', getKernelList)

async function getKernelList() {
  const list = await window.electronAPI.send('app:getCoreList')
  console.log('getKernelList', list)
  kernelUpdates.value = list.sort((a, b) => Number(b.coreVersion) - Number(a.coreVersion))
  genKernelGroup(toRaw(kernelUpdates.value))
}

function genKernelGroup(list: ResourceUpdateMessage[]) {
  const readMap = safeParseJSON(localStorage.getItem('kernel-read-map') || '{}')

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

  kernelUpdateGroup.value = list.reduce((acc, item, index) => {
    if (index === 0 && !['update', 'downloaded'].includes(item.status!) && !readMap[item.coreVersion!]) {
      acc[0].list.push({ ...item, _light: true, _desc: $t('新版本') })
    }
    else if (item.status === 'update' && !readMap[item.coreVersion!]) {
      acc[0].list.push({ ...item, _light: true, _desc: $t('有新的更新可用') })
    }
    else {
      acc[1].list.push(item)
    }
    return acc
  }, defaults).filter(item => item.list.length > 0)
}

function updateKernelReadRap(data: ResourceUpdateMessage) {
  const readMap = safeParseJSON(localStorage.getItem('kernel-read-map') || '{}')
  Reflect.deleteProperty(readMap, data.coreVersion!)
  localStorage.setItem('kernel-read-map', JSON.stringify(readMap))
}

function updateKernelStatus(data: ResourceUpdateMessage) {
  const item = kernelUpdateGroup.value.flatMap(item => item.list).find(item => item.coreVersion === data.coreVersion)
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
  if (isDownloadingKernel.value && !popoverRef.value?.instance?.visible) {
    btnRef.value?.btnEl.click()
    lastTime = Date.now()
    nextTick(() => {
      tabModel.value = tabs.value[1].value
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

window.electronAPI.on('app:resource-update', (data) => {
  // 内核升级
  if (data.type === 'kernel') {
    if (data.status === 'failed') {
      showDownloadError(data)
    }

    const index = kernelUpdates.value.findIndex(item => item.coreVersion === data.coreVersion)
    if (index === -1) {
      kernelUpdates.value.push(data)
      kernelUpdates.value.sort((a, b) => Number(b.coreVersion) - Number(a.coreVersion))
      genKernelGroup(toRaw(kernelUpdates.value))
    }
    else {
      kernelUpdates.value[index] = data
      updateKernelStatus(data)
    }

    if (data.status === 'downloaded') {
      updateKernelReadRap(data)
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

console.debug('clientUpdates', clientUpdates)
</script>

<template>
  <AppForceUpgradeModal :is-force-upgrade="isForceUpgrade" :update-info="updateInfo" />

  <div class="flex justify-center">
    <OverlayBadge :value="noticeNum" severity="danger" size="small" :class="{ 'no-message': !noticeNum }">
      <RxButton ref="btn" icon="base/rx_ic_updates" severity="secondary" :rotate="isDownloading" outlined size="xs" @click="toggle" />
    </OverlayBadge>

    <RyPopover ref="popover" :class="popup.content">
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
