<script setup lang="tsx">
import SingleProxies from './components/single-proxies.vue'
import batchProxies from './components/batch-proxies.vue'
import { useProxyCreateLabels } from './proxy-create-mode'
import type { ProxyCreateMode } from './proxy-create-mode'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { useUserStore } from '/@/stores/user'

const { mode: modeProp } = defineProps<{
  mode?: ProxyCreateMode
}>()

const { mixpanelTrack } = useUserStore()
const { saveProxyModules } = useProxyModuleCreate()

const labels = useProxyCreateLabels(computed(() => modeProp ?? 'proxy'))

const tabs = ref([
  { title: $t('单个添加'), value: 'single' },
  { title: $t('批量添加'), value: 'batch' },
])
const tabsValue = ref('single')

async function saveProxies(__proxies: any[]) {
  await saveProxyModules(__proxies, { labels: labels.value })
}

function onTabsChange(value: string | number) {
  if (value === 'batch')
    mixpanelTrack('click_batch_add_proxy')
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <ViewsHeader show-back :divider="false" :title="labels.pageTitle" />
    <div class="proxies-tabs">
      <Tabs v-model:value="tabsValue" @update:value="onTabsChange">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
    </div>
    <div class="flex-ovh-1 w-full">
      <div class="mx-auto h-full pt-4 pb-5">
        <SingleProxies v-show="tabsValue === 'single'" show-remark :on-confirm="saveProxies" />
      </div>
      <batchProxies v-show="tabsValue === 'batch'" :on-confirm="saveProxies" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-tabs {
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--colors-border-divider);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
      color: var(--colors-text-text-secondary, #b2b6b8);
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
      color: var(--colors-text-text-brand, #12a3fc);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }
}
</style>
