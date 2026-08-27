<script setup lang="ts">
import ProviderBuy from './provider-buy/index.vue'
import ProviderExternal from './provider-external.vue'
import { useProxyStore } from '/@/stores/proxy'
import type { BuyEntryType, ProxyIpType } from '/@/enums/proxy'
import type { WorkspaceType } from '/@/enums/base'
import type { ProxyPurchaseMode } from '../utils/proxy-purchase-labels'

const { provider, entryType, mode, workspaceType, preferredProxyType } = defineProps<{
  provider?: Record<string, any>
  entryType?: BuyEntryType
  /** 不传则由 ProviderBuy 按当前工作区推断 */
  mode?: ProxyPurchaseMode
  workspaceType?: WorkspaceType
  /** 活动入口指定默认机房/住宅类型 */
  preferredProxyType?: ProxyIpType | 'datacenter' | 'residential'
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
                <div class="flex items-center gap-1.5">
                  <span class="tt-primary font-[Archivo] text-5 font-700 leading-7">
                    {{ data.title }}
                  </span>
                  <span class="py-1 px-2 rounded-full color-white font-[DingTalk_JinBuTi] text-3 font-400 leading-none" :class="[data.isJump ? 'partners-tag' : 'official-tag']">{{ data.isJump
                    ? $t('战略合作') : $t('官方自营') }}</span>
                </div>

                <div class="font-[DingTalk_JinBuTi] text-3 font-400 leading-none" :class="[data.isJump ? 'partners-desc' : 'official-desc']">
                  {{ data.isJump ? $t('全球动态代理 IP') : $t('超高质量·无网包退') }}
                </div>
              </div>
            </div>
          </template>
        </RxTabs>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="32" @click="$emit('close')" />
      </div>
      <div class="flex-1 flex flex-col overflow-hidden content">
        <component :is="item.data.isJump ? ProviderExternal : ProviderBuy" v-for="item in providers" v-show="activeKey === item.value" :key="item.value" v-model:auto-jump="autoJump" :data="item.data"
                   :entry-type="entryType" :mode="mode" :workspace-type="workspaceType" :preferred-proxy-type="preferredProxyType" :to-rola="toRola" @close="$emit('close')" @success="$emit('success', $event)"
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

.official {
  &-tag {
    background: linear-gradient(90deg, #15a2fd 0%, #da54f9 100%);
  }

  &-desc {
    background: linear-gradient(90deg, #fc9d12 0%, #fdae3a 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.partners {
  &-tag {
    background: linear-gradient(90deg, #2dc637 0%, #44affb 100%);
  }

  &-desc {
    background: linear-gradient(90deg, #2dc637 0%, #44affb 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.content {
  background: var(--colors-background-bg-page);
}
</style>
