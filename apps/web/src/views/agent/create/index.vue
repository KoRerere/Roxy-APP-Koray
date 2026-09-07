<script setup lang="tsx">
import SingleProxies from './components/single-proxies.vue'
import batchProxies from './components/batch-proxies.vue'
import { useProxyCreateLabels } from './proxy-create-mode'
import type { ProxyCreateMode } from './proxy-create-mode'
import { useProxy } from '/@/views/agent/hooks'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { BuyEntryType } from '/@/enums'

const { mode: modeProp } = defineProps<{
  mode?: ProxyCreateMode
}>()

const router = useRouter()
const { mixpanelTrack } = useUserStore()
const { saveProxyModules } = useProxyModuleCreate()
const { buyProxy } = useProxy()
const [showToast] = useResponseToast()

const labels = useProxyCreateLabels(computed(() => modeProp ?? 'proxy'))
const isDeviceMode = computed(() => labels.value.mode === 'device')

const tabs = ref([
  { title: $t('单个添加'), value: 'single' },
  { title: $t('批量添加'), value: 'batch' },
])
const tabsValue = ref('single')

async function saveProxies(proxies: any[]) {
  await saveProxyModules(proxies, { labels: labels.value })
}

/** 单条表单 confirm 已改为单对象，这里包成数组走统一保存 */
async function saveSingleProxy(formData: Record<string, any>) {
  await saveProxies([formData])
}

function onTabsChange(value: string | number) {
  if (value === 'batch') {
    mixpanelTrack('click_batch_add_proxy')
  }
}

/** 全页广告「立即购买」：弹购买菜单，成功后回列表并高亮新单 */
async function onBuyClick(preferredCountry?: string) {
  try {
    const orderInfo = await buyProxy({
      entryType: BuyEntryType.Immediate,
      ...(isDeviceMode.value ? { mode: 'device' as const } : {}),
      ...(preferredCountry ? { preferredCountry } : {}),
    })

    showToast(0, isDeviceMode.value
      ? $t('设备已购买成功，正在为您配置中，请稍后。若长时间未加载设备，请刷新页面或联系技术支持。')
      : $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

    const routeName = labels.value.successRouteName
    router.replace({
      name: routeName,
      query: routeName === 'agent-list'
        ? { name: 'shop', orderNo: orderInfo?.orderNo }
        : { orderNo: orderInfo?.orderNo },
    })
  }
  catch {
    // 用户关闭购买弹窗时 buyProxy reject，忽略即可
  }
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
      <div class="flex mx-auto h-full min-h-0">
        <SingleProxies v-show="tabsValue === 'single'" :mode="modeProp ?? 'proxy'" show-remark show-advertise :on-confirm="saveSingleProxy" @buy="onBuyClick" />
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
