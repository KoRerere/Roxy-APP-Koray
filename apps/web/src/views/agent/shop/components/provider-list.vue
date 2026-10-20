<script setup lang="ts">
import ProviderBuy from './provider-buy/index.vue'
import ProviderExternal from './provider-external.vue'
import './proxy-store-tokens.css'
import navGrid from '/@/assets/images/proxy/store-nav-grid.svg?url'
import navMask from '/@/assets/images/proxy/store-nav-mask.svg?url'
import navShapes from '/@/assets/images/proxy/store-nav-shapes.svg?url'
import { useProxyStore } from '/@/stores/proxy'
import type { BuyEntryType, ProxyIpType } from '/@/enums/proxy'
import type { WorkspaceType } from '/@/enums/base'
import type { ProxyPurchaseMode } from '../utils/proxy-purchase-labels'

const { provider, entryType, mode, workspaceType, preferredProxyType, preferredCountry } = defineProps<{
  provider?: Record<string, any>
  entryType?: BuyEntryType
  /** 不传则由 ProviderBuy 按当前工作区推断 */
  mode?: ProxyPurchaseMode
  workspaceType?: WorkspaceType
  /** 活动入口指定默认机房/住宅类型 */
  preferredProxyType?: ProxyIpType | 'datacenter' | 'residential'
  /** 检测失败引导购买：仅初始化「国家/地区」时匹配一次 */
  preferredCountry?: string
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
  if (!data) {
    return
  }
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
  <div class="relative flex-1 flex flex-col pt-3 w-100vw max-w-[1217px] overflow-hidden provider proxy-store">
    <div aria-hidden="true" class="absolute inset-x-0 top-0 h-60 overflow-hidden pointer-events-none bg-[var(--colors-background-bg-page)]">
      <div class="header-shapes" :style="{ backgroundImage: `url(${navShapes})`, maskImage: `url(${navMask})` }" />
      <img class="absolute top-0 left-0 max-w-none" :src="navGrid" alt="">
    </div>
    <template v-if="providers">
      <div class="relative h-[75px] shrink-0 flex items-center justify-between pr-7">
        <RxTabs v-model:value="activeKey" :tabs="providers" head-tabs only-tabs>
          <template #tab="{ data }">
            <div class="flex items-center gap-3">
              <img class="block w-8 rounded-1.5 image" :src="data.image">
              <div class="flex flex-col text-left gap-0.5">
                <div class="flex items-center gap-1.5">
                  <span class="tt-primary font-[Archivo] text-5 font-700 leading-7">
                    {{ data.title }}
                  </span>
                  <span v-if="data.isJump" class="py-1 px-2 rounded-full color-white font-[DingTalk_JinBuTi] text-3 font-400 leading-none partners-tag">{{ $t('战略合作') }}</span>
                </div>

                <div class="font-[DingTalk_JinBuTi] text-3.5 font-400 leading-none" :class="[data.isJump ? 'partners-desc' : 'official-desc']">
                  {{ data.isJump ? $t('全球动态代理 IP') : $t('超高质量·无网包退') }}
                </div>
              </div>
            </div>
          </template>
        </RxTabs>
        <button type="button" class="shrink-0 border-0 bg-transparent p-0 cursor-pointer color-[var(--colors-icon-icon-secondary)]" :aria-label="$t('关闭')" @click="$emit('close')">
          <SvgIcon name="base/rx_ic_delete" size="32" />
        </button>
      </div>
      <div class="relative flex-1 flex flex-col overflow-hidden content">
        <component :is="item.data.isJump ? ProviderExternal : ProviderBuy" v-for="item in providers" v-show="activeKey === item.value" :key="item.value" v-model:auto-jump="autoJump" :data="item.data"
                   :entry-type="entryType" :mode="mode" :workspace-type="workspaceType" :preferred-proxy-type="preferredProxyType" :preferred-country="preferredCountry" :to-rola="toRola" @close="$emit('close')" @success="$emit('success', $event)"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* Figma 顶部两层装饰，保留源 SVG 尺寸和遮罩位置。 */
.header-shapes {
  position: absolute;
  left: 1px;
  top: -120px;
  width: 1306.689px;
  height: 394.429px;
  opacity: 0.6;
  background-repeat: no-repeat;
  mask-repeat: no-repeat;
  mask-position: 0 120px;
  mask-size: 1216px 240px;
}

.provider {
  :deep(.p-tab) {
    padding: 14px 16px;
  }

  :deep(.p-tablist-tab-list) {
    gap: 24px;
  }

  :deep(.p-tab-active) {
    background: transparent;
  }

  :deep(.p-tablist-active-bar) {
    height: 4px;
  }
}

.image {
  border: 1px solid var(--colors-border-border-inactive);
}

.official {
  &-desc {
    background: var(--pattern-proxystore-support-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.partners {
  &-tag {
    background: var(--pattern-proxystore-partner-gradient);
  }

  &-desc {
    background: var(--pattern-proxystore-partner-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.content {
  background: var(--colors-background-bg-page);
}
</style>
