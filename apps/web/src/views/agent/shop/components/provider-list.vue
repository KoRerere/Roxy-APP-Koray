<script setup lang="ts">
import ProviderBuy from './provider-buy/index.vue'
import ProviderExternal from './provider-external.vue'
import { useProxyStore } from '/@/stores/proxy'
import type { BuyEntryType } from '/@/enums/proxy'
import type { WorkspaceType } from '/@/enums/base'
import type { ProxyPurchaseMode } from '../utils/proxy-purchase-labels'

const { provider, entryType, mode, workspaceType } = defineProps<{
  provider?: Record<string, any>
  entryType?: BuyEntryType
  /** 不传则由 ProviderBuy 按当前工作区推断 */
  mode?: ProxyPurchaseMode
  workspaceType?: WorkspaceType
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'success', data: any): void
}>()

const { getProxyVendors } = useProxyStore()

const providers = ref()
const activeKey = ref()
const autoJump = ref(provider?.autoJump)

onBeforeMount(() => {
  getProviders()
})

async function getProviders() {
  const data = await getProxyVendors()
  if (!data)
    return
  providers.value = data.filter(item => entryType ? !item.isJump : true).map(item => ({ title: item.vendorName, value: item.id, image: item.vendorIcon, isJump: item.isJump, data: item }))
  activeKey.value = provider?.proxyProviderId || providers.value[0]?.value
}

function toRola() {
  const item = providers.value.find((item: any) => item.title === 'Rola-IP')
  if (item) {
    activeKey.value = item.value
  }
}
</script>

<template>
  <div class="relative flex-1 flex flex-col pt-3 w-100vw max-w-300 overflow-hidden provider">
    <template v-if="providers">
      <div class="flex items-center justify-between pr-7">
        <RxTabs v-model:value="activeKey" :tabs="providers" head-tabs only-tabs>
          <template #tab="{ data }">
            <div class="flex items-center gap-3">
              <img class="block w-8 rounded-1.5 image" :src="data.image">
              <div class="flex flex-col text-left gap-0.5">
                <div class="title">
                  {{ data.title }}
                </div>
                <div v-if="!data.isJump" class="desc">
                  {{ $t('超高质量·无网包退') }}
                </div>
              </div>
            </div>
          </template>
        </RxTabs>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="32" @click="$emit('close')" />
      </div>
      <div class="flex-1 flex flex-col overflow-hidden content">
        <component :is="item.data.isJump ? ProviderExternal : ProviderBuy" v-for="item in providers" v-show="activeKey === item.value" :key="item.value" v-model:auto-jump="autoJump" :data="item.data"
                   :entry-type="entryType" :mode="mode" :workspace-type="workspaceType" :to-rola="toRola" @close="$emit('close')" @success="$emit('success', $event)"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.provider {
  :deep(.p-tab) {
    padding: 16px;
  }

  :deep(.p-tablist-active-bar) {
    height: 4px;
  }
}

.image {
  border: 1px solid var(--colors-border-border-inactive);
}

.title {
  color: var(--colors-text-text-primary);
  font-family: Archivo;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}

.desc {
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: normal;

  background: linear-gradient(90deg, #fc9d12 0%, #fdae3a 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.content {
  background: var(--colors-background-bg-page);
}
</style>
