<script setup lang="ts">
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
import StepIndicator from './step-indicator.vue'
import { BuyEntryType } from '/@/enums/proxy'
import { useProxyStore } from '/@/stores/proxy'
import type { CountryOption } from '/@/views/agent/shop/components/provider-buy/utils'
import ProviderBuy from '/@/views/agent/shop/components/provider-buy/index.vue'
import { WorkspaceType } from '/@/enums/base'
import { getImage } from '/@/utils/basic'

type ProxyVendor = UserGetProxyVendorListListData['data'][number]

interface DisplayCountry {
  country_code_upper: string
  country_name: string
  continent_name: string
}

const { onNext } = defineProps<{
  onNext: (type: 'choose' | 'third' | 'platform') => void
}>()

const { getProxyVendors } = useProxyStore()

const currentProvider = ref<ProxyVendor>()
const country = ref<DisplayCountry>()

onBeforeMount(() => {
  initPageData()
})

async function initPageData() {
  const vendors = await getProxyVendors()
  if (!vendors?.length)
    return

  currentProvider.value = vendors.find(item => !item.isJump) ?? vendors[0]
}

/** 与 ProviderBuy 内选中国家保持同步 */
function onCountryChange(selected?: CountryOption) {
  if (!selected)
    return

  country.value = {
    country_name: selected.country_name,
    continent_name: selected.continent_name ?? '',
    country_code_upper: selected.country_code?.toUpperCase() ?? '',
  }
}

function onSuccess() {
  onNext('platform')
}
</script>

<template>
  <div class="relative flex flex-col items-center w-full h-full overflow-hidden">
    <div class="w-4/5 flex flex-col gap-8 pt-30 pb-10 overflow-y-auto">
      <StepIndicator :current="0" />
      <div v-if="country" class="h-32 flex items-center gap-9 px-5 rounded-3 device">
        <div class="flex items-center">
          <div class="relative w-28 h-28">
            <svg class="ring-spin ring-spin--cw absolute top-1/2 left-1/2" xmlns="http://www.w3.org/2000/svg" width="114" height="114" viewBox="0 0 114 114" fill="none">
              <circle opacity="0.2" cx="56.5186" cy="56.5186" r="56" stroke="white" stroke-width="1.03704" stroke-linecap="round" stroke-dasharray="4.15 4.15" />
            </svg>
            <svg class="ring-spin ring-spin--ccw absolute top-1/2 left-1/2" xmlns="http://www.w3.org/2000/svg" width="95" height="95" viewBox="0 0 95 95" fill="none">
              <circle opacity="0.4" cx="47.1852" cy="47.1852" r="46.6667" stroke="white" stroke-width="1.03704" stroke-linecap="round" stroke-dasharray="4.15 4.15" />
            </svg>
            <div class="absolute top-1/2 left-1/2 transform -translate-1/2 w-19 h-19 rounded-full">
              <img class="block w-full h-full" :src="getImage('ecommerce/earth.png')">
              <div class="absolute -top-0.5 right-0.5 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-white">
                <SvgIcon :name="(`country-code/${country.country_code_upper}` as any)" />
              </div>
            </div>
          </div>
          <div class="connection" aria-hidden="true">
            <div class="connection__line" />
            <div class="connection__dots">
              <i
                v-for="n in 4"
                :key="n"
                class="connection__dot"
                :style="{ '--i': n - 1 }"
              />
            </div>
          </div>
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="94" height="68" viewBox="0 0 94 68" fill="none">
              <path
                d="M4.67985 67.8819C3.08263 67.8819 1.73497 67.2996 0.636882 66.135C-1.13172 64.2593 1.07963 61.8924 3.65764 61.8924H13.0653C11.468 61.8924 10.0705 61.2934 8.87256 60.0955C7.67464 58.8976 7.07568 57.5 7.07568 55.9028V5.98958C7.07568 4.39236 7.67464 2.99479 8.87256 1.79688C10.0705 0.598959 11.468 0 13.0653 0H80.7476C82.3448 0 83.7424 0.598959 84.9403 1.79688C86.1382 2.99479 86.7372 4.39236 86.7372 5.98958V55.9028C86.7372 57.5 86.1382 58.8976 84.9403 60.0955C83.7424 61.2934 82.3448 61.8924 80.7476 61.8924H90.107C92.7116 61.8924 94.9179 64.2932 93.0761 66.135C91.9115 67.2996 90.4972 67.8819 88.8335 67.8819H4.67985ZM46.9064 65.6858C47.8382 65.6858 48.6368 65.3529 49.3022 64.6875C49.9677 64.0221 50.3005 63.2234 50.3005 62.2917C50.3005 61.3599 49.9677 60.5613 49.3022 59.8958C48.6368 59.2304 47.8382 58.8976 46.9064 58.8976C45.9746 58.8976 45.176 59.2304 44.5106 59.8958C43.8451 60.5613 43.5123 61.3599 43.5123 62.2917C43.5123 63.2234 43.8451 64.0221 44.5106 64.6875C45.176 65.3529 45.9746 65.6858 46.9064 65.6858Z"
                fill="url(#paint0_linear_938_64090)"
              />
              <defs>
                <linearGradient id="paint0_linear_938_64090" x1="46.9064" y1="0" x2="46.9064" y2="67.8819" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#89D0FC" />
                  <stop offset="1" stop-color="#11A3FD" />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute left-3 top-1.25 w-17.5 h-13 bg-white" />
            <SvgIcon class="absolute top-4.5 left-1/2 transform -translate-x-1/2" name="base/rx_ic_wifi2" size="24" color="var(--colors-icon-icon-brand)" />
          </div>
        </div>
        <div class="flex flex-col h-full gap-2.5 pt-8">
          <div class=" tt-primary text-3.5 leading-4 color-white">
            {{ $t('已为你接入一台真实设备 · 当地原生网络出口') }}
          </div>
          <div class="flex items-center gap-2.5 py-2.5">
            <SvgIcon :name="(`country-code/${country.country_code_upper}` as any)" size="32" />
            <div class="color-white text-6 font-700 leading-normal">
              {{ country.country_name }}
            </div>
            <div class="country">
              {{ country.country_code_upper }}
            </div>
            <div class="flex items-center gap-1.5 px-3">
              <span class="feature">{{ $t('{continent}节点', { continent: country.continent_name }) }}</span>
              <span class="feature">
                <SvgIcon name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-success)" />
                <span>{{ $t('独享纯净环境') }}</span>
              </span>
              <span class="feature">
                <SvgIcon name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-success)" />
                <span>{{ $t('账号永不关联') }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <ProviderBuy v-if="currentProvider" class="-mt-3" :data="currentProvider" :entry-type="BuyEntryType.Immediate" mode="device" :workspace-type="WorkspaceType.ECommerce" :cancel-redirect="false"
                   @country-change="onCountryChange" @success="onSuccess"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.device {
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: linear-gradient(122deg, #18a7ff -4.5%, #87d1fc 99.35%);
}

:deep(.selectors) {
  padding-left: 20px;
  border: 1px solid var(--colors-border-border-action, #c7d1d6);
}

:deep(.summary) {
  width: 340px;
  padding-top: 0;
  padding-right: 0;
}

:deep(.notes) {
  display: none;
}

.country {
  padding: 0 8px;
  height: 18px;
  line-height: 18px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
  color: #fff;
  font-family: 'DingTalk Sans';
  font-size: 12px;
}

.feature {
  display: flex;
  padding: 3px 8px;
  justify-content: center;
  align-items: center;
  gap: 2px;
  border-radius: 60px;
  border: 1px solid #e2e9ee;
  background: #fff;

  color: #34393d;
  font-size: 12px;
  font-weight: 600;
  line-height: 17px;
}

/* 地球 ↔ 设备之间的连接线：小圆点左→右流动，两端自然淡入淡出 */
.connection {
  position: relative;
  width: 80px;
  height: 16px;
  flex-shrink: 0;

  &__line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1.5px;
    transform: translateY(-50%);
    background: #b1e2fb;
  }

  &__dots {
    position: absolute;
    inset: 0;
    /* 左淡入、右淡出，避免圆点在端点硬切 */
    mask-image: linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%);
  }

  &__dot {
    position: absolute;
    top: 50%;
    left: 0;
    width: 8px;
    height: 8px;
    margin-top: -4px;
    border-radius: 50%;
    border: 2px solid #b1e2fb;
    box-sizing: border-box;
    background-color: #15afff;
    animation: connection-flow 3.2s linear infinite;
    animation-delay: calc(var(--i) * 0.8s);
  }
}

@keyframes connection-flow {
  0% {
    left: 0;
  }

  100% {
    left: calc(100% - 6px);
  }
}

/* 虚线圆环：外圈顺时针、内圈逆时针，keyframe 内保留居中 translate */
.ring-spin {
  transform: translate(-50%, -50%);

  &--cw {
    animation: ring-spin-cw 16s linear infinite;
  }

  &--ccw {
    animation: ring-spin-ccw 12s linear infinite;
  }
}

@keyframes ring-spin-cw {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes ring-spin-ccw {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(-360deg);
  }
}
</style>
