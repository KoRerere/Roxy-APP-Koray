<script setup lang="ts">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import batchProxies from './components/batch-proxies.vue'
// import RecommendedProxies from './components/recommended-proxies.vue'
import singleProxies from './components/single-proxies.vue'

const router = useRouter()
const [_, onlyErrorToast] = useResponseToast()

const tabs = ref([
  { title: $t('单个添加'), value: 'single' },
  { title: $t('批量添加'), value: 'batch' },
  // { title: $t('代理推荐'), value: 'recommended' },// 第一版不上推荐功能
])
const tabsValue = ref('single')

async function saveProxies(proxies: any) {
  const { code, msg } = await API.proxy.userAddProxyModuleCreate(proxies)
  if (code === 0) {
    router.replace({ name: 'agent-list' })
  }
  onlyErrorToast(code, msg)
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <ViewsHeader show-back :title="$t('添加代理')" />
    <div class="proxies-tabs">
      <Tabs v-model:value="tabsValue">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
    </div>
    <div class="flex-ovh-1 w-full">
      <singleProxies v-show="tabsValue === 'single'" @save="saveProxies" />
      <batchProxies v-show="tabsValue === 'batch'" @save="saveProxies" />
      <!-- <RecommendedProxies v-show="tabsValue === 'recommended'" /> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-tabs {
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: var(--Font-Size-text-sm, 12px);
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      border-color: transparent;

      &:not(.p-tab-active):not(.p-disabled):hover {
        border-color: transparent;
      }
    }

    .p-tab-active {
      color: var(--Colors-Text-text-brand, #12a3fc);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }
}
</style>
