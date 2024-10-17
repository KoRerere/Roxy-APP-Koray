<script setup lang="ts">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import batchProxies from './components/batch-proxies.vue'
import RecommendedProxies from './components/recommended-proxies.vue'
import singleProxies from './components/single-proxies.vue'

const router = useRouter()
const [_, onlyErrorToast] = useResponseToast()

const tabs = ref([
  { title: $t('Single Proxy'), value: 'single' },
  { title: $t('Multi Proxies'), value: 'batch' },
  { title: $t('Recommended Proxies'), value: 'recommended' },
])
const tabsValue = ref('single')

async function saveProxies(proxies: any) {
  const { code, msg } = await API.proxy.userAddProxyModuleCreate(proxies)
  if (code === 0) {
    router.replace({ name: 'agent-list' })
  }
  onlyErrorToast(code, msg)
}

function cancel() {
  router.back()
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        {{ $t('Proxies') }}
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
      <RecommendedProxies v-show="tabsValue === 'recommended'" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
