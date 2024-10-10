<script setup lang="ts">
import { API } from '/@/api'
import batchProxies from './components/batch-proxies.vue'
import singleProxies from './components/single-proxies.vue'

const router = useRouter()

const tabs = ref([
  { title: '单个代理', value: 'single' },
  { title: '批量代理', value: 'batch' },
])
const tabsValue = ref('single')

async function saveProxies(proxies: any) {
  const res = await API.proxy.userAddProxyModuleCreate(proxies)
  console.log('🚀 ~ saveProxies ~ res:', res)
  router.replace({ name: 'agent-list' })
}

function cancel() {
  router.back()
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        Proxies
      </div>
    </div>
    <Tabs v-model:value="tabsValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </Tabs>
    <div class="flex-ovh-1 w-full">
      <singleProxies v-show="tabsValue === 'single'" @cancel="cancel" @save="saveProxies" />
      <batchProxies v-show="tabsValue === 'batch'" @cancel="cancel" @save="saveProxies" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
