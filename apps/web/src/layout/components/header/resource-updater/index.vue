<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { onMounted, ref, useTemplateRef } from 'vue'
import { $t } from '/@/locales'
import AppForceUpgradeModal from './app-force-upgrade-modal.vue'
import AppUpdater from './app-updater.vue'
import KernelUpdater from './kernel-updater.vue'

const popoverRef = useTemplateRef('popover')
const btnRef = useTemplateRef('btn')
const clientUpdates = ref<ResourceUpdateMessage[]>([])
const kernelUpdates = ref<ResourceUpdateMessage[]>([])
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
    list: kernelUpdates,
    value: 'kernel',
    badge: computed(() => kernelUpdates.value.filter(item => item.status === 'downloading').length),
    component: markRaw(KernelUpdater),
  },
])
const tabModel = ref(tabs.value[0].value)
const isDownloadingKernel = ref(false)

const noticeNum = computed(() => {
  return clientUpdates.value.length + kernelUpdates.value.filter(item => item.status === 'downloading').length
})

const isDownloading = computed(() => {
  return [...clientUpdates.value, ...kernelUpdates.value].some(item => item.status === 'downloading')
})

// APP 是否强制升级
const isForceUpgrade = computed(() => {
  return clientUpdates.value.some(item => item.type === 'app' && item.status === 'downloaded' && item.originUpgradeData?.forceUpgrade)
})

async function checkForUpdates() {
  electronAPI.send('app:checkForUpdates')
  electronAPI.send('app:checkWebForUpdates')
}

function toggle(event: Event) {
  const popIns = popoverRef.value?.getRef()
  popIns.toggle(event)
  if (popIns.visible) {
    tabs.value.some(tab => {
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
  kernelUpdates.value = list.sort((a, b) => b.coreVersion - a.coreVersion)
}

watch(isDownloadingKernel, () => {
  console.log('isDownloadingKernel', popoverRef.value?.getRef())
  if (isDownloadingKernel.value && !popoverRef.value?.getRef().visible) {
    btnRef.value?.btnEl.click()
    nextTick(() => {
      tabModel.value = tabs.value[1].value
      // 5 分钟内不重复提示
      setTimeout(() => {
        isDownloadingKernel.value = false
      }, 60000 * 5)
    })
  }
})

window.electronAPI.on('app:resource-update', (data) => {
  // 内核升级
  if (data.type === 'kernel') {
    const index = kernelUpdates.value.findIndex(item => item.coreVersion === data.coreVersion)
    if (index === -1) {
      kernelUpdates.value.push(data)
    }
    else {
      kernelUpdates.value[index] = data
    }
    isDownloadingKernel.value = data.status === 'downloading' && !data.silent
    kernelUpdates.value.sort((a, b) => b.coreVersion - a.coreVersion)
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
  }
})
</script>

<template>
  <AppForceUpgradeModal :is-force-upgrade="isForceUpgrade" />

  <div class="flex justify-center">
    <OverlayBadge :value="noticeNum" severity="danger" size="small" :class="{ 'no-message': !noticeNum }">
      <RxButton ref="btn" icon="base/rx_ic_updates" severity="secondary" :rotate="isDownloading" outlined size="xs"
        @click="toggle" />
    </OverlayBadge>

    <RyPopover ref="popover" :class="classes.popover">
      <div class="header">
        <div class="title">
          {{ $t('更新') }}
        </div>
      </div>
      <Tabs v-model:value="tabModel">
        <TabList :class="classes.tablist" :pt="{ tablist: 'px-4 gap-4 h-[40px]', activeBar: '!h-[2px]' }">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value"
            class="flex flex-1 justify-center items-center gap-1.5">
            {{ tab.title }}
            <Badge v-if="tab.badge" :value="tab.badge" severity="danger" size="small" />
          </Tab>
        </TabList>
        <TabPanels class="!pa-0 min-h-[100px] max-h-[280px] overflow-auto">
          <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value" :class="classes.tabpanel">
            <component :is="tab.component" :upgrade-list="tab.list" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </RyPopover>
  </div>
</template>

<style lang="scss" module="classes">
.popover {
  width: var(--width-xs, 384px);

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

.tabpanel {
  overflow: hidden;
}
</style>

<style lang="scss" scoped>
.no-message {
  :deep(.p-badge) {
    display: none;
  }
}
</style>
