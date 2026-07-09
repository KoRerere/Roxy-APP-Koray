<script setup lang="ts">
import currency from 'currency.js'
import RadioButton from 'primevue/radiobutton'
import { I18nT } from 'vue-i18n'
import RxLoading from '/@/components/rx-loading.vue'
import RxButton from '/@/components/rx-button'
import RxStepInput from '/@/components/rx-step-input/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { ProxyIpType } from '/@/enums/proxy'
import { getProxyTypePriceForSelectedDuration } from './utils'
import type { BandwidthOption, BusinessUseOption, DurationOption, ProxyTypeOption } from './utils'

const {
  isCN,
  isDirect,
  loadingProxyType,
  currentInventory,
  proxyTypeOptions,
  proxySpeedOptions,
  subscriptionMonths,
  businessUse,
  details,
  canPay,
  payTooltip,
  officialWebsiteUrl,
  vendorName = '',
} = defineProps<{
  isCN: boolean
  isDirect: boolean
  loadingProxyType: boolean
  currentInventory: number
  proxyTypeOptions: ProxyTypeOption[]
  proxySpeedOptions: BandwidthOption[]
  subscriptionMonths?: DurationOption
  businessUse?: BusinessUseOption
  details: any[]
  canPay: boolean
  payTooltip?: string
  officialWebsiteUrl: string
  vendorName?: string
}>()

const emit = defineEmits<{
  pay: []
}>()

const ONE_BUY_MAX = 1000

const purchaseMember = defineModel<number>('purchaseMember', { required: true })
const proxyTypeValue = defineModel<number | undefined>('proxyTypeValue')
const proxySpeedValue = defineModel<number | undefined>('proxySpeedValue')

const styles = useCssModule()
const CID = `${getCurrentInstance()?.uid ?? ''}-ptype`

function getUnitPrice(proxyType: ProxyTypeOption) {
  return getProxyTypePriceForSelectedDuration(proxyType, subscriptionMonths?.value)
}

function inputPurchaseMember(value: number) {
  nextTick(() => {
    if (!value)
      purchaseMember.value = 1
  })
}

const notes = computed(() => [
  {
    text: $t('所有代理 IP 都 {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('同时支持 SOCKS5 和 HTTP 协议')],
  },
  {
    text: $t('您购买的所有代理 IP 都是 {bold0}，不会与他人共享。', { bold0: '{bold0}' }),
    bolds: [$t('独享专用 IP')],
  },
  {
    text: $t('订阅期间所有代理 IP {bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('不限流量')],
  },
  {
    text: $t('若购买的代理 IP 出现 {bold0} 的问题，支持 {bold1}。', { bold0: '{bold0}', bold1: '{bold1}' }),
    bolds: [$t('无法连接'), $t('免费更换或退款')],
  },
  {
    text: $t('您可以在代理 IP 列表中延长代理 IP 的使用期限，{bold0}。', { bold0: '{bold0}' }),
    bolds: [$t('价格与购买时相同')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('代理 IP 过期后将被停用，无法找回或再次续费。')],
  },
  {
    text: $t('{bold0}', { bold0: '{bold0}' }),
    bolds: [$t('所有代理 IP 均由 Roxy浏览器从 {name} 特挑。', { name: vendorName })],
  },
].slice(0, vendorName === 'RoxyIP' ? 6 : 7))
</script>

<template>
  <div class="shrink-0 py-5 w-95 flex flex-col pr-8 gap-2 overflow-hidden overflow-y-auto">
    <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :content="$t('检测到您当前网络环境位于中国大陆，当前代理 IP 暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。')" />
    <RxAlert v-if="isDirect" class="!w-full shrink-0" type="warn" :content="$t('专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
    <div class="flex flex-col gap-2">
      <div v-if="proxyTypeValue != null" class="flex flex-col gap-1.5 pa-4 quantity">
        <div class="tt-primary text-3.5 font-600 leading-normal">
          {{ $t('代理 IP 数量:') }}
        </div>
        <RxStepInput v-model="purchaseMember" size="lg" :min="1" :max="Math.min(Math.max(1, currentInventory), ONE_BUY_MAX)" @update:model-value="inputPurchaseMember" />
      </div>
      <Detail :list="details">
        <template #title="props">
          <div class="flex items-center gap-2">
            <div v-bind="props">
              {{ $t('代理 IP 信息') }}
            </div>
            <div v-if="isDirect" class="px-2 rounded-full" :class="styles.direct">
              {{ $t('大陆直连') }}
            </div>
          </div>
        </template>
        <template #type>
          <div class="relative">
            <RxLoading :model-value="loadingProxyType" :opacity="0.1" />
            <div class="flex flex-col gap-1.5">
              <label v-for="item in proxyTypeOptions" :key="item.id" class="w-full flex items-start gap-1.5 select-none cursor-pointer" :for="`${CID}_${item.id}`">
                <RadioButton v-model="proxyTypeValue" class="!hidden" :input-id="`${CID}_${item.id}`" :value="item.id" name="proxy-provider-type" />
                <div class="w-full flex items-center gap-2 min-w-0">
                  <div class="flex items-center gap-1.5 min-w-0 flex-1">
                    <div class="shrink-0 details-radio" :class="{ checked: proxyTypeValue === item.id }" />
                    <div class="tt-secondary text-3.5 leading-5 truncate" :class="{ premium: item.proxyType === ProxyIpType.Residential }">
                      {{ item.typeName }}
                    </div>
                    <SvgIcon v-if="item.desc" v-tooltip.top="item.desc" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
                  </div>
                  <div v-if="getUnitPrice(item)" class="flex gap-2 shrink-0 whitespace-nowrap">
                    <span class="tt-secondary text-4 font-[DingTalk_JinBuTi] leading-5">
                      {{ $t('{month}/个', { month: currency(getUnitPrice(item)!.proxyPrice).format() }) }}
                    </span>
                    <span v-if="getUnitPrice(item)!.proxyPrice < getUnitPrice(item)!.originalProxyPrice" class="tt-inactive text-3 leading-5 line-through">
                      {{ $t('{month}/个', { month: currency(getUnitPrice(item)!.originalProxyPrice).format() }) }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </template>
        <template #speed="{ item }">
          <div class="flex flex-col gap-3">
            <RxDivider class="col-span-4" line-style="dashed" line-only line-color="var(--colors-border-divider-dashed)" />
            <div v-if="isDirect">
              <I18nT tag="div" class="tt-secondary font-[DingTalk_JinBuTi] text-3.5 leading-4 select-none" :keypath="$t('电商直连 IP 默认支持 {value}', { value: '{value}' })" scope="global">
                <template #value>
                  <span class="bandwidth">100Mbps</span>
                </template>
              </I18nT>
            </div>
            <template v-else>
              <div class="flex items-center gap-1">
                <span class="tt-secondary text-3.5">{{ item.label }}</span>
                <SvgIcon v-tooltip.top="$t('当前仅支持美国、香港、法国和日本的超高质量代理 IP 进行带宽升级。')" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
              </div>
              <div class="grid grid-cols-4 gap-1.5">
                <div v-for="option in proxySpeedOptions" :key="option.value" v-tooltip.top="{ value: option.bandwidthSpeedDesc }"
                     class="col-span-2 h-10 flex items-center justify-center px-3 leading-none cursor-pointer select-none tt-primary !text-3.5"
                     :class="[styles.period, styles.radio, proxySpeedValue === option.value ? styles.active : '']" @click="proxySpeedValue = option.value"
                >
                  {{ option.label }}
                </div>
              </div>
            </template>
          </div>
        </template>
        <template #price="{ item }">
          <div class="flex justify-between items-center">
            <div class="details-label">
              {{ item.label }}
            </div>
            <div>
              <div class="details-price">
                {{ item.value }}
              </div>
              <div v-if="item.diffValue > 0" class="details-diffprice">
                {{ $t('节省 {value}', { value: currency(item.diffValue).format() }) }}
              </div>
            </div>
          </div>
        </template>
        <template #after>
          <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
            <div v-if="businessUse?.isSpecialOffer" class="tt-inactive text-3 leading-5 text-center">
              {{ $t('请注意：当前代理 IP 为特价商品，不退不换') }}
            </div>
            <RxButton v-tooltip.top="payTooltip" size="lg" :disabled="!canPay" :label="$t('立即支付')" @click="emit('pay')" />
            <I18nT tag="div" class="tt-tertiary text-3 leading-4.5 select-none" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
              <template #terms>
                <a class="terms" :href="officialWebsiteUrl" target="_blank">{{ $t('用户协议') }}</a>
              </template>
            </I18nT>
          </div>
        </template>
      </Detail>
      <div class="flex flex-col gap-2">
        <div class="tt-primary text-3.5 font-600 leading-normal">
          {{ $t('注意事项:') }}
        </div>
        <ol class="ma-0 pl-4">
          <I18nT
            v-for="item in notes"
            :key="item.text"
            tag="li"
            class="tt-tertiary text-3.25 leading-6"
            :keypath="item.text"
            scope="global"
          >
            <template v-for="(bold, index) in item.bolds" :key="index" #[`bold${index}`]>
              <span class="tt-secondary font-bold">{{ bold }}</span>
            </template>
          </I18nT>
        </ol>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.radio {
  border-radius: 8px;
  border: 3px solid var(--pattern-pay-plan-bg-bill);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  &:not(.active):hover {
    background: var(--colors-background-bg-action-hover);
  }

  &.active {
    border-color: var(--colors-border-border-brand);
    background: var(--pattern-pay-gradient-selected-start);
    box-shadow: none;

    &.period {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }
}

.period {
  color: var(--colors-text-text-primary);
  font-size: 16px;
}

.direct {
  color: #34393d;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}
</style>

<style lang="scss" scoped>
.premium {
  font-size: 15px;
  font-family: 'DingTalk JinBuTi';
  background: linear-gradient(90deg, #e635f9 0%, #12a3fc 60.1%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.quantity {
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-action, #c7d1d6);
  background: var(--colors-background-bg-action, #fff);

  :deep(.step) {
    border: none;
    gap: 24px;

    .p-inputtext {
      padding: 4px 0;
      font-size: 32px;
      font-weight: 600;
      box-shadow: none;

      &:focus,
      &:hover {
        border-radius: 4px;
        background: var(--colors-background-bg-action-hover);
      }
    }

    .p-button {
      box-shadow: none;

      svg {
        font-size: 32px;
        font-weight: 600;
      }

      &:disabled {
        background: transparent;
        opacity: 0.8;
      }
    }
  }
}

.bandwidth {
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.details {
  &-radio {
    position: relative;
    width: 16px;
    height: 16px;
    border: 1px solid var(--colors-border-border-brand);
    border-radius: 50%;

    &.checked {
      border-width: 2px;

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background: var(--colors-border-border-brand);
        border-radius: 50%;
      }
    }
  }

  &-label {
    font-family: 'DingTalk JinBuTi';
    font-size: 15px;
    line-height: 16px;
    background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-price {
    color: #12a3fc;
    text-align: right;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-diffprice {
    color: var(--primitives-yellow-500);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-brand);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
