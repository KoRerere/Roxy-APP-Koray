<script setup lang="ts">
import Identity from '/@/views/pay/wallet/manage/identity.vue';
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import currency from 'currency.js'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user';

const emit = defineEmits(['close', 'success'])

const { userPayInfo, identityInfo } = storeToRefs(useUserStore())
const [showToast] = useResponseToast()

const currentProvider = defineModel()

const animationGradient = ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)']
const providers = ref<Record<string, any>[]>()
const redeemCode = ref('')

onBeforeMount(() => {
  getProviders()
})

async function getProviders() {
  const { data } = await API.proxy.userGetProxyProviderListList()
  providers.value = data.map(item => ({ ...item, proxyPriceFmt: currency(item.proxyPrice!).format() }))
}

function onBuy(item: any) {
  currentProvider.value = item
}

function onClose() {
  emit('close')
}

async function redeem() {
  const { code, msg } = await API.proxy.userRedeemProxyCodeCreate({ code: redeemCode.value })
  showToast(code, msg)
  if (code !== 0) return
  redeemCode.value = ''
  emit('close')
  emit('success')
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-9 py-8 w-240 overflow-hidden">
    <div class="px-8 header">
      <div class="flex items-center justify-between">
        <span class="header-title">{{ $t('代理 IP 商店') }}</span>
        <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="onClose" />
      </div>
      <div class="mt-2.5 header-desc">{{ $t('RoxyBrowser 为您精选、验证、集成了来自不同可靠服务商的最优质代理 IP。') }}</div>
    </div>
    <div class="flex-1 flex flex-col px-8 gap-9 overflow-y-auto">
      <div class="flex flex-col gap-5">
        <AnimationBorder class="-mb-2.5" v-if="identityInfo.icon || userPayInfo.proxyDiscount" :gradient="animationGradient" bg-color="var(--pattern-sidenav-metrics-btn)">
          <Identity class="px-3 py-2"></Identity>
        </AnimationBorder>
        <div class="grid grid-cols-2 gap-5">
          <div class="pa-5 provider" v-for="item in providers" :key="item.proxyProviderName">
            <div class="h-full flex flex-col">
              <div class="flex items-center gap-2.5">
                <img class="block w-11 h-11 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="item.proxyProviderIcon" />
                <div class="flex flex-col gap-0.5">
                  <div class="provider-name">{{ item.proxyProviderName }}</div>
                  <div class="provider-website">{{ item.proxyProviderWebsite }}</div>
                </div>
              </div>
              <div class="flex-1 mt-2.5 provider-desc">{{ item.proxyProviderDesc }}</div>
              <RxDivider class="my-4" line-only></RxDivider>
              <div class="flex items-center gap-2.5">
                <div class="provider-desc">{{ $t('代理类型') }}:</div>
                <div class="provider-tag" v-for="tag in item.proxyTypeList">{{ tag.typeName }}</div>
              </div>
              <RxDivider class="my-4" line-only></RxDivider>
              <div class="flex flex-col gap-3">
                <div class="provider-subtitle">{{ $t('优势') }}</div>
                <div class="provider-advantages">
                  <div class="flex items-center gap-1.5" v-for="advantage in item.proxyProviderAdv">
                    <SvgIcon class="cursor-pointer" name="status/rx_ic_check_fill" size="14" />
                    <span class="provider-desc">{{ advantage }}</span>
                  </div>
                </div>
              </div>
              <div class="mt-5 flex justify-end items-center">
                <div v-if="item.proxyProviderName !== 'RoxyBrowser'" class="flex-1 provider-price">{{ $t('Roxy 独家特惠: 低至 {amount} / IP', { amount: item.proxyPriceFmt }) }}</div>
                <RxButton v-if="!userPayInfo.proxyDiscount" icon="base/rx_ic_cart" :label="$t('购买代理 IP')" @click="onBuy(item)"></RxButton>
              </div>
              <div class="relative mt-3" v-if="userPayInfo.proxyDiscount">
                <div class="absolute top-0 right-3 -translate-y-1/2 px-3 py-1 rounded-full z-1 discount">{{ $t('额外 {discount}% Off', { discount: userPayInfo.proxyDiscount }) }}</div>
                <RxButton class="w-full" size="md" icon="base/rx_ic_cart" :label="$t('购买代理 IP')" @click="onBuy(item)"></RxButton>
              </div>
            </div>
          </div>
          <div v-if="providers && providers.length % 2 !== 0" class="flex flex-col justify-center items-center gap-6 pa-6 connect">
            <div class="w-88 flex flex-col items-center gap-1.5">
              <div class="connect-text">{{ $t('更多类型的优质代理 IP 即将推出...') }}</div>
              <div class="connect-desc">{{ $t('我们将会为您集成更多高质量的代理 IP 服务，敬请期待！') }}</div>
            </div>
            <RxButton severity="secondary" outlined icon="base/rx_ic_headphone_2" :label="$t('联系我们')" @click="$showLiveChat"></RxButton>
          </div>
        </div>
        <div v-if="providers && providers.length % 2 === 0" class="flex justify-between items-center gap-6 pa-6 connect">
          <div class="connect-text">{{ $t('更多类型的优质代理 IP 即将推出...') }}</div>
          <RxButton severity="secondary" outlined icon="base/rx_ic_headphone_2" :label="$t('联系我们')" @click="$showLiveChat"></RxButton>
        </div>
      </div>
      <RxDivider line-only line-style="dashed"></RxDivider>
      <div class="flex justify-between items-center select-none">
        <div class="flex flex-col gap-1.5">
          <div class="redeem-title">{{ $t('兑换代理 IP') }}</div>
          <div class="redeem-desc">{{ $t('从 Roxy 官方礼品或奖励中兑换代理 IP') }}</div>
        </div>
        <div class="flex gap-2.5">
          <TsFormInputText class="!w-75" v-model="redeemCode" size="lg" :placeholder="$t('在此处粘贴兑换码')"></TsFormInputText>
          <RxButton severity="secondary" variant="outlined" size="lg" :disabled="!redeemCode" :label="$t('兑换')" @click="redeem" />
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
    padding: 5px 6px;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);
    color: var(--colors-text-text-secondary);
    font-family: "JetBrains Mono";
    font-size: 10px;
    font-weight: 800;
    line-height: 8px;
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

.discount {
  background: #FC9D12;
  color: #FFF;
  font-family: "DingTalk JinBuTi", sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
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

.redeem {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 14px;
    line-height: 20px;
  }
}
</style>
