<script setup lang="ts">
import currency from 'currency.js'
import { API } from '/@/api'
import { $t } from '/@/locales'

const emit = defineEmits(['close'])

const currentProvider = defineModel()

const providers = ref<Record<string, any>[]>()

onBeforeMount(() => {
  getProviders()
})

async function getProviders() {
  const { data } = await API.proxy.userGetProxyProviderListList()
  providers.value = data.map(item => ({ ...item, proxyPriceFmt: currency(item.proxyPrice).format() }))
}

function onBuy(item: any) {
  currentProvider.value = item
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-9 pa-8 w-240">
    <div class="header">
      <div class="flex items-center justify-between">
        <span class="header-title">{{ $t('代理商店') }}</span>
        <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="onClose" />
      </div>
      <div class="mt-2.5 header-desc">{{ $t('RoxyBrowser 为您精选、验证、集成了来自不同可靠服务商的最优质代理。') }}</div>
    </div>
    <div class="flex flex-col gap-5">
      <div class="gap-5 content">
        <div class="pa-5 provider" v-for="item in providers" :key="item.proxyProviderName">
          <div>
            <div class="flex items-center gap-2.5">
              <img class="block w-11 h-11 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="item.proxyProviderIcon" />
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <span class="provider-name">{{ item.proxyProviderName }}</span>
                  <span class="provider-tag">{{ $t('静态住宅代理') }}</span>
                </div>
                <div class="provider-website">{{ item.proxyProviderWebsite }}</div>
              </div>
            </div>
            <div class="mt-2.5 provider-desc">{{ item.proxyProviderDesc }}</div>
            <div class="my-4 provider-divider"></div>
            <div class="flex flex-col gap-3">
              <div class="provider-subtitle">{{ $t('优势') }}</div>
              <div class="provider-advantages">
                <div class="flex items-center gap-1.5" v-for="advantage in item.proxyProviderAdv">
                  <SvgIcon class="cursor-pointer" name="status/rx_ic_check_fill" size="14" />
                  <span class="provider-desc">{{ advantage }}</span>
                </div>
              </div>
            </div>
            <div class="mt-5 flex justify-between items-center">
              <div class="provider-price">{{ $t('Roxy 独家特惠: {amount} / IP', { amount: item.proxyPriceFmt }) }}</div>
              <RxButton icon="base/rx_ic_cart" :label="$t('购买代理')" @click="onBuy(item)"></RxButton>
            </div>
          </div>
        </div>
        <div class="flex flex-col justify-center items-center gap-6 pa-6 connect">
          <div class="w-88 flex flex-col items-center gap-1.5">
            <div class="connect-text">{{ $t('更多类型的优质代理即将推出...') }}</div>
            <div class="connect-desc">{{ $t('我们将会为您集成更多高质量的服务商及代理，敬请期待！') }}</div>
          </div>
          <RxButton severity="secondary" outlined icon="base/rx_ic_headphone_2" :label="$t('联系我们')" @click="$showLiveChat"></RxButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-size: 16px;
    line-height: normal;
  }
}

.content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.provider {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-inactive);
  box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  background-color: var(--colors-background-bg-overlay);

  &-name {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-tag {
    display: flex;
    padding: 1px 4px;
    justify-content: center;
    align-items: center;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);
    color: var(--component-tag-text);
    font-family: "JetBrains Mono";
    font-size: 10px;
    font-weight: 800;
    line-height: normal;
  }

  &-website {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 16px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 13px;
    line-height: 18px;
  }

  &-divider {
    border-bottom: 1px solid var(--component-dropdown-divider);
  }

  &-subtitle {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 500;
    line-height: normal;
  }

  &-advantages {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  &-price {
    font-family: "DingTalk JinBuTi";
    font-size: 13px;
    line-height: 16px;
    background: linear-gradient(90deg, #12A3FC 0%, #DB54F9 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.connect {
  border-radius: 8px;
  background: var(--colors-background-bg-block);

  &-text {
    color: var(--colors-text-text-primary);
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-inactive);
    text-align: center;
    font-size: 13px;
    line-height: 18px;
  }
}
</style>
