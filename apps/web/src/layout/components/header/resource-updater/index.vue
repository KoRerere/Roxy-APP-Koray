<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { onMounted, ref, useTemplateRef } from 'vue'
import { $t } from '/@/locales'
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
    component: markRaw(AppUpdater),
  },
  {
    title: $t('内核升级'),
    list: kernelUpdates,
    value: 'kernel',
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

async function checkForUpdates() {
  // const result = await electronAPI.send('app:checkForUpdates')
  // console.log('checkForUpdates', result)
}

function toggle(event: Event) {
  popoverRef.value?.getRef().toggle(event)
  checkForUpdates()
}

onMounted(() => {
  getKernelList()
  checkForUpdates()
})

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
  console.log('app:resource-update', data)
  // 内核升级
  if (data.type === 'kernel') {
    const index = kernelUpdates.value.findIndex(item => item.coreVersion === data.coreVersion)
    if (index === -1) {
      kernelUpdates.value.push(data)
    }
    else {
      kernelUpdates.value[index] = data
    }
    isDownloadingKernel.value = data.status === 'downloading'
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
    console.log('clientUpdates', clientUpdates.value)
  }
})
</script>

<template>
  <div class="flex justify-center">
    <OverlayBadge :value="noticeNum" severity="danger" size="small" :class="{ 'no-message': !noticeNum }">
      <RxButton ref="btn" icon="base/rx_ic_updates" severity="secondary" :rotate="isDownloading" outlined size="xs" @click="toggle" />
    </OverlayBadge>

    <RyPopover ref="popover" :class="classes.popover">
      <div class="header">
        <div class="title">
          {{ $t('更新') }}
        </div>
      </div>
      <Tabs v-model:value="tabModel">
        <TabList :class="classes.tablist" :pt="{ tablist: 'px-4 gap-4 h-[40px]', activeBar: '!h-[2px]' }">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value" class="flex flex-1 justify-center items-center gap-1.5">
            {{ tab.title }}
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
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 24px; /* 171.429% */
  }
}

.tabpanel {
  max-height: 400px;
  overflow: hidden auto;
}
</style>

<style lang="scss" scoped>
.no-message {
  :deep(.p-badge) {
    display: none;
  }
}
</style>
