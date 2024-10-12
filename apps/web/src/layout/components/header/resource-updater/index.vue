<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { onMounted, ref, useTemplateRef } from 'vue'
import { $t } from '/@/locales'
import AppUpdater from './app-updater.vue'
import KernelUpdater from './kernel-updater.vue'

const featureTitleList = ref([
  { title: $t('Feature'), key: 'new_function' },
  { title: $t('Improvements'), key: 'optimize' },
  { title: $t('Bug fixes'), key: 'resolve_bug' },
])

const popoverRef = useTemplateRef('popover')
const clientUpdates = ref<ResourceUpdateMessage[]>([
  {
    type: 'app', // 类型：app、web、patch
    downloadUrl: 'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/package/app/Windows/64/1.4', // 下载地址
    version: '1.4', // 版本号，我们自己定义的版本号，用来和客户端的比对
    upgradeTitle: 'update available', // 升级标题
    upgradeDesc: 'test-content-1\ntest-content-2\ntest-content-3', // 升级描述
    upgradeContent: `<p><strong>Improvements</strong></p><ul><li style=\"line-height: 1;\">We’ve improved the performance of the profiles list rendering</li></ul><p style=\"line-height: 1;\"><strong>Bug fixes</strong></p><ul><li style=\"line-height: 1;\">We’ve fixed a couple of bugs and RoxyBrowser is now compatible with macOS</li><li style=\"line-height: 1;\">Various memory leaks were fixed in RoxyBrowser and certain profiles will now render correctly</li></ul>`, // 新版升级内容描述
    releaseTime: '2024-04-16', // 发布时间
    webDomain: 'https://lumibrowser-hk.oss-cn-hongkong.aliyuncs.com', // 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港
  },
])
const kernelUpdates = ref<ResourceUpdateMessage[]>([])
const tabs = ref([
  {
    title: 'Client updates',
    list: clientUpdates,
    value: 'client',
    component: markRaw(AppUpdater),
  },
  {
    title: 'Kernel updates',
    list: kernelUpdates,
    value: 'kernel',
    component: markRaw(KernelUpdater),
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
  list.forEach((item) => {
    item.upgradeContent = {
      new_function: '<li>增加xxxx</li><li>增加xxxx</li>',
      optimize: '<li>We’ve improved the performance of the profiles list rendering</li>',
      resolve_bug: `<li>We’ve fixed a couple of bugs and RoxyBrowser is now compatible with macOS</li>
       <li>Various memory leaks were fixed in RoxyBrowser and certain profiles will now render correctly</li>`,
    }
  })
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
</script>

<template>
  <div class="flex justify-center">
    <OverlayBadge :value="noticeNum" severity="danger" size="small">
      <ry-button icon="base/rx_ic_updates" outlined size="small" @click="toggle" />
    </OverlayBadge>

    <Popover ref="popover" :class="classes.popover">
      <Tabs :value="tabs[0].value">
        <TabList :class="classes.tablist">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value" :class="classes.tabpanel">
            <component :is="tab.component" :upgrade-list="tab.list" :feature-title-list="featureTitleList" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Popover>
  </div>
</template>

<style lang="scss" module="classes">
.popover {
  width: var(--width-xs, 384px);

  :global(.p-popover-content) {
    padding: 0;
  }
  :global(.p-tabpanels) {
    padding: 0;
  }
  :global(.p-tabpanels:has(.p-tabpanel:first-of-type.p-tabpanel-active)) {
    background: var(--Color-blue-100, #e8f5fc);
  }
  :global(.p-tablist-active-bar) {
    height: 2px;
    border-radius: 1px;
  }
}
.tablist {
  :global(.p-tablist-tab-list) {
    justify-content: space-around;
  }
}
.tabpanel {
  max-height: 400px;
  overflow: hidden auto;
}
</style>

<style lang="scss" scoped>

</style>
