<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { ref } from 'vue'

const op = ref()
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

function toggle(event) {
  op.value.toggle(event)
}

window.electronAPI.on('app:resource-update', (data) => {
  console.log('app:resource-update', data)

  if (data.type === 'app') {
    clientUpdates.value = [data]
  }
  else if (data.type === 'patch') {
    kernelUpdates.value = [data]
  }
})

function handleItemClick(item) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.status === 'downloading') {
    return 'Downloading'
  }
  else if (info.status === 'downloaded') {
    window.electronAPI.send('app:install-update', info)
  }
  else {
    window.electronAPI.send('app:download-update', info)
  }
}

function getButtonLabel(item) {
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
</script>

<template>
  <div class="card flex justify-center">
    <OverlayBadge :value="clientUpdates.length" severity="danger">
      <Button type="button" icon="pi pi-arrow-circle-up" label="Upgrade" @click="toggle" />
    </OverlayBadge>

    <Popover ref="op" :class="classes.popover">
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
                <div class="mb-[6px]">
                  <div class="flex justify-between">
                    <span>{{ item.title }} {{ item.version }}</span>
                    <span>{{ item.releaseTime }}</span>
                  </div>
                  <div>{{ item.description }}</div>
                  <Button
                    type="button" :label="getButtonLabel(item)" icon="pi pi-download"
                    :loading="item.status === 'downloading'"
                    @click="handleItemClick(item)"
                  />
                </div>
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
