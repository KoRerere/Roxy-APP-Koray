<script setup lang="ts">
import Identity from '/@/views/pay/wallet/manage/identity.vue'
import { API } from '/@/api'

import { useUserStore } from '/@/stores/user'
import ProviderCard from './provider-card.vue'

const emit = defineEmits(['close', 'success'])

const { userPayInfo, identityInfo } = storeToRefs(useUserStore())

const currentProvider = defineModel()

const animationGradient = ['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)']
const providers = ref<Record<string, any>[]>()

async function getProviders() {
  const { data } = await API.proxy.userGetProxyProviderListList()
  providers.value = data || []
}

function onClose() {
  emit('close')
}

onBeforeMount(() => {
  getProviders()
})

function updateApiKey(id: number, apiKey: string) {
  if (providers.value) {
    for (let i = 0; i < providers.value.length; i++) {
      const item = providers.value[i]!
      if (item.id === id) {
        item.jumpInfo.apiKey = apiKey
        break
      }
    }
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-9 py-8 w-240 overflow-hidden">
    <div class="px-8 header">
      <div class="flex items-center justify-between">
        <span class="header-title">{{ $t('代理 IP 商店') }}</span>
        <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="onClose" />
      </div>
      <div class="mt-2.5 header-desc">
        {{ $t('RoxyBrowser 为您精选、验证、集成了来自不同可靠服务商的最优质代理 IP。') }}
      </div>
    </div>
    <div class="flex-1 flex flex-col px-8 gap-9 overflow-y-auto">
      <div class="flex flex-col gap-5">
        <AnimationBorder v-if="userPayInfo.proxyDiscount" class="-mb-2.5" :gradient="animationGradient" bg-color="var(--pattern-sidenav-metrics-btn)">
          <Identity class="px-3 py-2" />
        </AnimationBorder>
        <div class="grid grid-cols-2 gap-5">
          <template v-if="!providers">
            <div v-for="item in 2" :key="item" class="flex flex-col pa-5 provider">
              <div class="flex items-center gap-2.5">
                <Skeleton :pt="{ root: skeleton.bg }" size="44px" />
                <Skeleton :pt="{ root: skeleton.bg }" width="100px" height="20px" />
              </div>
              <Skeleton :pt="{ root: skeleton.bg }" class="mt-2.5" height="16px" />
              <Skeleton :pt="{ root: skeleton.bg }" class="mt-1.5" width="60%" height="16px" />
              <RxDivider class="my-4" line-only line-color="var(--component-dropdown-divider)" />
              <div class="flex gap-2.5">
                <Skeleton :pt="{ root: skeleton.bg }" width="70px" height="18px" />
                <Skeleton :pt="{ root: skeleton.bg }" width="70px" height="18px" />
              </div>
              <RxDivider class="mt-4" line-only line-color="var(--component-dropdown-divider)" />
              <Skeleton :pt="{ root: skeleton.bg }" class="mt-5" width="154px" height="20px" />
            </div>
          </template>
          <ProviderCard
            v-for="item in providers"
            v-else
            :key="item.proxyProviderName"
            v-model="currentProvider"
            :item="item"
            :update-api-key="updateApiKey"
          />

          <div v-if="providers && providers.length % 2 !== 0" class="flex flex-col justify-center items-center gap-6 pa-6 connect">
            <div class="w-88 flex flex-col items-center gap-1.5">
              <div class="connect-text">
                {{ $t('更多类型的优质代理 IP 即将推出...') }}
              </div>
              <div class="connect-desc">
                {{ $t('我们将会为您集成更多高质量的代理 IP 服务，敬请期待！') }}
              </div>
            </div>
            <RxButton severity="secondary" outlined icon="base/rx_ic_headphone_2" :label="$t('联系我们')" @click="$showLiveChat" />
          </div>
        </div>
        <div v-if="providers && providers.length % 2 === 0" class="flex justify-between items-center gap-6 pa-6 connect">
          <div class="connect-text">
            {{ $t('更多类型的优质代理 IP 即将推出...') }}
          </div>
          <RxButton severity="secondary" outlined icon="base/rx_ic_headphone_2" :label="$t('联系我们')" @click="$showLiveChat" />
        </div>
      </div>
      <!-- <RxDivider line-only line-style="dashed" line-color="var(--component-dropdown-divider)" />
      <div class="flex justify-between items-center select-none">
        <div class="flex flex-col gap-1.5">
          <div class="redeem-title">
            {{ $t('兑换代理 IP') }}
          </div>
          <div class="redeem-desc">
            {{ $t('从 Roxy 官方礼品或奖励中兑换代理 IP') }}
          </div>
        </div>
        <div class="flex gap-2.5">
          <TsFormInputText v-model="redeemCode" class="!w-75" size="lg" :placeholder="$t('在此处粘贴兑换码')" />
          <RxButton severity="secondary" variant="outlined" size="lg" :disabled="!redeemCode" :label="$t('兑换')" @click="redeem" />
        </div>
      </div> -->
    </div>
  </div>
</template>

<style module="skeleton">
.bg {
  background: var(--component-skeleton-bg-overlay) !important;
}
</style>

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
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  background-color: var(--colors-background-bg-overlay);

  // &-name {
  //   color: var(--colors-text-text-primary);
  //   font-size: 16px;
  //   font-weight: 600;
  //   line-height: 20px;
  // }

  // &-tag {
  //   padding: 5px 6px;
  //   border-radius: 2px;
  //   border: 1px solid var(--component-tag-border);
  //   background: var(--component-tag-bg);
  //   color: var(--colors-text-text-secondary);
  //   font-family: 'JetBrains Mono';
  //   font-size: 10px;
  //   font-weight: 800;
  //   line-height: 8px;
  // }

  // &-website {
  //   color: var(--colors-text-text-tertiary);
  //   font-size: 12px;
  //   line-height: 16px;
  // }

  // &-desc {
  //   color: var(--colors-text-text-secondary);
  //   font-size: 13px;
  //   line-height: 18px;
  // }

  // &-subtitle {
  //   color: var(--colors-text-text-primary);
  //   font-size: 13px;
  //   font-weight: 500;
  //   line-height: normal;
  // }

  // &-price {
  //   font-family: 'DingTalk JinBuTi';
  //   font-size: 13px;
  //   line-height: 16px;
  //   background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
  //   background-clip: text;
  //   -webkit-background-clip: text;
  //   -webkit-text-fill-color: transparent;
  // }
}

// .discount {
//   background: #fc9d12;
//   color: #fff;
//   font-family: 'DingTalk JinBuTi', sans-serif;
//   font-size: 12px;
//   font-weight: 500;
//   line-height: normal;
// }

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
