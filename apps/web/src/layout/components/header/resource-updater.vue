<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type Popover from 'primevue/popover'
import { onMounted, ref, useTemplateRef } from 'vue'

const popoverRef = useTemplateRef('popover')
const clientUpdates = ref<ResourceUpdateMessage[]>([])
const kernelUpdates = ref<ResourceUpdateMessage[]>([])
const tabs = ref([
  {
    title: 'Client updates',
    list: clientUpdates,
    value: 'client',
  },
  {
    title: 'Kernel updates',
    list: kernelUpdates,
    value: 'kernel',
  },
])

const noticeNum = computed(() => {
  return clientUpdates.value.length + kernelUpdates.value.filter(item => item.status === 'downloading').length
})

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

onMounted(() => {
  getKernelList()
})

async function getKernelList() {
  const list = await window.electronAPI.send('app:getCoreList')
  console.log('getKernelList', list)
  kernelUpdates.value = list
}

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
  }
  // 客户端升级(app、web、patch)
  else {
    const index = clientUpdates.value.findIndex(item => data.type === item.type && item.title === data.title)
    if (index === -1) {
      clientUpdates.value.push(data)
    }
    else {
      clientUpdates.value[index] = data
    }
    console.log('clientUpdates', clientUpdates.value)
  }
})

function handleClientItemClick(item: ResourceUpdateMessage) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.status === 'downloading') {
    return 'Downloading'
  }
  else if (info.status === 'downloaded') {
    window.electronAPI.send('app:install-update', info)
  }
  else {
    // window.electronAPI.send('app:download-update', info)
  }
}

function handleKernelItemClick(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return 'Downloading'
  }
  else if (item.status === 'uninstalled' && item.coreVersion) {
    window.electronAPI.send('app:download-chrome-core', item.coreVersion)
  }
}

function formatClientBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `Downloading ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return 'Install and relaunch'
  }
  else if (item.status === 'failed') {
    return 'Retry'
  }
  else {
    return 'Download'
  }
}

function formatKernelBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `Downloading ${Math.floor(item.percent)}%`
  }
  else if (item.status === 'downloaded') {
    return 'Installed'
  }
  else if (item.status === 'failed') {
    return 'Retry'
  }
  else {
    return 'Install'
  }
}
</script>

<template>
  <div class="flex justify-center">
    <OverlayBadge :value="noticeNum" severity="danger" size="small">
      <ry-button icon="base/rx_ic_renew" outlined size="small" @click="toggle" />
    </OverlayBadge>

    <Popover ref="popover" :class="classes.popover">
      <Tabs :value="tabs[0].value">
        <TabList :class="classes.tablist">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value">
            <template v-if="tab.list.length">
              <template v-for="item in tab.list" :key="item.title">
                <!-- APP 更新列表 -->
                <template v-if="item.type === 'app'">
                  <div class="flex items-start">
                    <img src="/logo.svg" class="w-[32px] h-[32px] mr-[6px]">
                    <div class="flex-auto mb-[6px]">
                      <div class="flex justify-between">
                        <span>{{ item.title }} {{ item.version }}</span>
                        <span>{{ item.releaseTime }}</span>
                      </div>
                      <div>{{ item.description }}</div>
                      <Button
                        type="button"
                        :label="formatClientBtnLabel(item)"
                        icon="pi pi-download"
                        :loading="item.status === 'downloading'"
                        class="mt-[6px]"
                        @click="handleClientItemClick(item)"
                      />
                    </div>
                  </div>
                </template>
                <!-- 内核更新列表 -->
                <template v-else>
                  <div class="flex items-start mb-[6px]">
                    <img src="/kernel-logo.png" class="w-[32px] h-[32px] mr-[6px]">
                    <div class="flex-auto">
                      <div class="flex justify-between items-center">
                        <span>{{ item.title }} {{ item.coreVersion }}</span>
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
                    </div>
                  </div>
                </template>
              </template>
            </template>
            <template v-else>
              <h3>No updates available</h3>
            </template>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Popover>
  </div>
</template>

<style lang="scss" module="classes">
.popover {
  width: var(--width-xs, 384px);
}
.tablist {
  :global(.p-tablist-tab-list) {
    justify-content: space-around;
  }
}
</style>
