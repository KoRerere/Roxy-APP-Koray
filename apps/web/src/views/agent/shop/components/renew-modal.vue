<script setup lang="tsx">
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import currency from 'currency.js'
import { addDays, format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook'
import { useMidAutumnActivity } from '/@/views/campaign/mid-autumn-festival/hook'
import { API } from '/@/api'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { usePay } from '/@/views/pay/wallet/hook'
import { PayWay } from '/@/enums/pay'
import { ProxyOrderType, ProxyType } from '/@/enums/proxy'
import { hasVisiblePriceDiscount, purchaseMonthsToDays } from '/@/views/pay/subscribe/util'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'
import { useProxyShopLabels } from '../utils/proxy-shop-labels'
import { I18nT } from 'vue-i18n'
import {
  calcProxyRenewOriginalAmount,
  calcProxyRenewTotalAmount,
  calcProxyRenewUnitPrice,
  canUseLongRenewFirst,
  formatDiscountOff,
  getMaxAppliedOffPercent,
  getProxyRenewOffMix,
  hasLongRenewFirstOffer,
  percentOffToZhe,
} from '../utils/long-renew-first'

interface Props {
  data: any[]
}

interface RenewPeriod {
  label: string
  value: number
  day: number
  discount: number
  proxyPrice: number
  proxyPurchaseMonths: number
}

const { data: dataList } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const themeStore = useThemeStore()
const { userPayInfo } = storeToRefs(useUserStore())
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const toast = useToast()
const { openProcessing } = usePay()
const { showFreedomActivityModal } = useFreedomActivity()
const { showLuckyDrawAfterPay } = useMidAutumnActivity()
const { beforeToggleAutoRenew } = useConfirmAutoRenew()
const shopLabels = useProxyShopLabels()

/** 续费结算时一并提交；默认关闭，需用户确认后才会变为开启 */
const isAuto = ref(false)
/** 时长折扣接口按天返回 % Off；缺省为空对象，不挡续费主流程 */
const discountsByDays = ref<Record<string, number>>({})
const periods = ref<RenewPeriod[]>()
const periodValue = ref<RenewPeriod>()
const loading = ref(false)

const hasEligibleLongRenew = computed(() => hasLongRenewFirstOffer(dataList))

/** 低至 n 折跟账户最低优惠档走；后端 % Off 为 0 时不展示，避免写死 7 折 */
const longRenewTag = computed(() => {
  const off = Number(userPayInfo.value.proxyRenewMinDiscount ?? 0) || 0
  if (off <= 0) {
    return ''
  }
  // 中文用 {discount} 折，英/俄用 {off}% off，同一组参数交给翻译选用
  return $t('长续首享·低至 {discount}折', { discount: percentOffToZhe(off), off })
})

const columns = [
  {
    title: $t('出口 IP'),
    key: 'outbound',
    render: ({ data }: any) => (
      <OutboundIp
        country={data.lastCountry}
        city={data.lastCity}
        lastIp={data.lastIp}
        time={data.checkTime}
        offerLabel={canUseLongRenewFirst(data) && longRenewTag.value ? longRenewTag.value : undefined}
      />
    ),
  },
  {
    title: $t('Roxy 独家特惠'),
    key: 'price',
    slot: 'price',
  },
  {
    title: $t('服务商'),
    key: 'proxyProviderName',
    getText: (data: any) => data.proxyProviderName || '--',
  },
  {
    title: $t('类型'),
    key: 'proxyType',
    getText: (data: any) => data.proxyType === ProxyType.buy ? $t('购买') : $t('添加'),
  },
  {
    title: $t('到期时间'),
    key: 'expireDate',
    slot: 'expired',
  },
]

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/proxy/shop_dialog_bg.svg")' : 'url("/images/proxy/shop_dialog_bg_dark.svg")'
})

/** 底价用原价，长续与身份折扣取更优后逐 IP 加总 */
const totalAmount = computed(() => {
  const months = periodValue.value?.value ?? 0
  const day = periodValue.value?.day ?? 0
  return calcProxyRenewTotalAmount(
    dataList,
    months,
    day,
    userPayInfo.value.proxyDiscount ?? 0,
    discountsByDays.value,
  )
})

/** 未打折的原价合计，划线原价与「共计优惠」都相对它计算 */
const originalAmount = computed(() => {
  const months = periodValue.value?.value ?? 0
  return calcProxyRenewOriginalAmount(dataList, months)
})

/** 相对原价的立省金额，仅在有可见折扣时展示 */
const discountAmount = computed(() => {
  return currency(originalAmount.value).subtract(totalAmount.value).value
})

/** 两位小数后仍有差额才展示划线原价，避免折算精度把原价/实付判成不相等 */
const hasFooterDiscount = computed(() => {
  return hasVisiblePriceDiscount(originalAmount.value, totalAmount.value)
})

/** 已享最优折扣展示本次实际用到的最大一档 % Off，不用原价/实付加权比 */
const appliedOffPercentText = computed(() => {
  const off = getMaxAppliedOffPercent(
    dataList,
    periodValue.value?.day ?? 0,
    userPayInfo.value.proxyDiscount ?? 0,
    discountsByDays.value,
  )
  if (off <= 0 || !hasFooterDiscount.value) {
    return ''
  }
  const rounded = Math.round(off * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
})

/** 当前时长下是否部分走长续、部分未走；混合时底部改走长续专享人数 */
const footerOffMix = computed(() => {
  return getProxyRenewOffMix(
    dataList,
    periodValue.value?.day ?? 0,
    userPayInfo.value.proxyDiscount ?? 0,
    discountsByDays.value,
  )
})

/** 混合场景展示当前档位长续折数，不用加权总价比 */
// const mixedLongRenewOfferText = computed(() => {
//   const off = footerOffMix.value.longRenewOff
//   return $t('长续首享 {discount} 折', {
//     discount: percentOffToZhe(off),
//     off,
//   })
// })

/** 混合优惠文案插值：中文折数在 script 内算好，tsx setup 的导入函数不能直接进模板 */
const mixedLongRenewZhe = computed(() => percentOffToZhe(footerOffMix.value.longRenewOff))

/** 按天取长续首享 % Off；缺档位时为 0，避免把空值当成已配置折扣 */
function getDurationOffPercent(day: number) {
  return Number(discountsByDays.value[String(day)] ?? 0) || 0
}

/**
 * 促销条折扣跟接口走：90/180/360 档位固定，折数随后台配置变。
 * 中文用 {zhe} 折，英/俄用 {off}% off，同一组参数交给翻译选用。
 */
const promoDiscountDesc = computed(() => {
  const off90 = getDurationOffPercent(90)
  const off180 = getDurationOffPercent(180)
  const off360 = getDurationOffPercent(360)
  // 折扣接口失败时不展示 10 折，避免和真实优惠脱节
  if (!off90 && !off180 && !off360) {
    return ''
  }
  return $t('首次续费 IP 优惠: {day90} 天 IP 享 {zhe90} 折，{day180} 天 IP 享 {zhe180} 折，{day360} 天 IP 享 {zhe360} 折', {
    day90: 90,
    zhe90: percentOffToZhe(off90),
    off90,
    day180: 180,
    zhe180: percentOffToZhe(off180),
    off180,
    day360: 360,
    zhe360: percentOffToZhe(off360),
    off360,
  })
})

/** 表格单价随所选时长取长续/身份更优折扣，直连不套身份折扣，与结算同一套口径 */
function getRowUnitPrice(row: {
  proxyProviderPrice?: number
  longRenewFirstEligible?: boolean
  longRenewFirstUsed?: boolean
  isDirect?: boolean
}) {
  return calcProxyRenewUnitPrice({
    proxyProviderPrice: row.proxyProviderPrice ?? 0,
    day: periodValue.value?.day ?? 0,
    longRenewFirstEligible: row.longRenewFirstEligible,
    longRenewFirstUsed: row.longRenewFirstUsed,
    isDirect: row.isDirect,
    identityOff: userPayInfo.value.proxyDiscount ?? 0,
    discountsByDays: discountsByDays.value,
  })
}

onBeforeMount(() => {
  getPeriodList()
})

async function getPeriodList() {
  loading.value = true
  try {
    const [priceRes, discountRes] = await Promise.all([
      API.proxy.userGetProxyPurchaseTimePriceList({}),
      API.proxy.userGetProxyDurationDiscountsByDaysList(),
    ])
    onlyErrorToast(priceRes.code, priceRes.msg)
    if (priceRes.code !== 0) {
      return
    }

    if (discountRes.code === 0 && discountRes.data) {
      discountsByDays.value = discountRes.data
    }
    else {
      onlyErrorToast(discountRes.code, discountRes.msg)
    }

    const purchaseTimePrice = priceRes.data.map((item) => {
      const day = purchaseMonthsToDays(item.proxyPurchaseMonths)
      return {
        ...item,
        label: $t('{day} 天', { day }),
        value: item.proxyPurchaseMonths,
        day,
        discount: Number(discountsByDays.value[String(day)] ?? 0) || 0,
      }
    })

    periods.value = purchaseTimePrice
    // 有长续资格时默认勾选 360 天，先露出最高档优惠；列表没有该档再回落到第一项
    const longRenewDefault = hasEligibleLongRenew.value
      ? purchaseTimePrice.find(item => item.day === 360)
      : undefined
    periodValue.value = longRenewDefault ?? purchaseTimePrice[0]
  }
  finally {
    loading.value = false
  }
}

async function onPay() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <WalletPayModal
          amount={totalAmount.value}
          onClose={hideModal}
          onConfirm={onConfirm}
        />
      ),
    },
  })

  async function onConfirm({ payType }: any) {
    const expectedAmount = totalAmount.value
    const renewIdList = dataList.map(item => item.id)
    const payload = {
      payType,
      renewIdList,
      orderType: ProxyOrderType.Renew,
      subscriptionMonths: periodValue.value?.value,
      isAuto: isAuto.value,
    }
    const { code, data, msg } = await API.pay.userBuyProxySettlementCreate(payload)
    onlyErrorToast(code, msg)
    if (code !== 0) {
      return
    }

    // 并发占用资格时后端会按最新资格重算；金额对不上只提示，支付仍以后端为准
    const paid = Number(data.real_amount ?? data.order_amount)
    if (Number.isFinite(paid) && currency(paid).format() !== currency(expectedAmount).format()) {
      toast.add({
        severity: 'warn',
        summary: $t('操作成功'),
        detail: $t('部分 IP 的长续首享资格已发生变化，优惠及订单金额已重新计算。'),
        life: 5000,
      })
    }
    (payType === PayWay.Balance
      ? Promise.resolve()
      : openProcessing(data, 'silent'))
      .then(() => {
        showLuckyDrawAfterPay()
        showFreedomActivityModal()
        emit('close')
        emit('success')
      })
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-4 pa-8 rounded-lg w-240 popup">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div class="flex items-center justify-between">
      <span class="header">{{ shopLabels.renewTitle }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="24" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3 h-70">
        <div class="tt-primary text-3.5 font-500 leading-normal">
          {{ shopLabels.renewCountDesc(dataList.length) }}
        </div>
        <RyTable class="proxies" :columns="columns" :data-list="dataList" :show-table-header="false" :paginator="false" :show-actions="false">
          <template #price="{ data: row }">
            <div>
              <div class="text-3.25 font-[DingTalk_JinBuTi]">
                {{ currency(getRowUnitPrice(row)).format() }}
              </div>
              <div v-if="hasVisiblePriceDiscount(row.proxyProviderPrice, getRowUnitPrice(row))" class="tt-tertiary line-through">
                {{ currency(row.proxyProviderPrice).format() }}
              </div>
            </div>
          </template>
          <template #expired="{ data: row }">
            <div class="flex items-center gap-3">
              <span>{{ format(new Date(row.expireDate || Date.now()), "yyyy/MM/dd") }}</span>
              <SvgIcon name="base/rx_ic_play" size="12" />
              <span class="color-[var(--colors-text-text-success)]">{{ format(addDays(new Date(row.expireDate || Date.now()), periodValue?.day ?? 0), 'yyyy/MM/dd') }}</span>
            </div>
          </template>
        </RyTable>
      </div>
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-3">
          <div class="tt-primary text-3.5 font-500 leading-5">
            {{ $t('IP 续费时长:') }}
          </div>
          <div class="flex gap-4">
            <div v-for="item in periods" :key="item.value" class="relative h-10 flex items-center px-5 leading-none cursor-pointer select-none period radio"
                 :class="{ active: item.value === periodValue?.value }" @click="periodValue = item"
            >
              <span v-if="hasEligibleLongRenew && item.discount > 0" class="period-discount">
                {{ formatDiscountOff(item.discount) }}
              </span>
              {{ item.label }}
            </div>
          </div>
        </div>
        <div v-if="hasEligibleLongRenew" class="flex flex-col gap-2 pa-3.5 rounded-[6px] promo">
          <div class="promo-title">
            {{ $t('一次续一年，省心更省钱！') }}
          </div>
          <div class="flex gap-2 items-center text-3.5 leading-5 w-full">
            <span class="promo-desc">{{ promoDiscountDesc }}</span>
            <span class="promo-hint">{{ $t('( 每个 IP 仅可享 1 次 )') }}</span>
            <!-- 无身份折扣时不存在叠加取优，不必展示该提示 -->
            <!-- 身份折扣文案暂不对外展示，取优逻辑仍生效 -->
            <!-- <SvgIcon v-if="userPayInfo.proxyDiscount" v-tooltip.top="{ value: $t('该优惠不与身份优惠叠加，系统自动选取最优折扣'), showDelay: 300 }" class="shrink-0 cursor-pointer" name="base/rx_ic_info" size="16"
                     color="var(--colors-icon-icon-note)"
            /> -->
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="tt-primary text-3.5 font-500 leading-5">
          {{ $t('自动续费') }}
        </div>
        <RxToggleSwitch v-model="isAuto" :before-change="beforeToggleAutoRenew" />
      </div>
      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-base)" />
      <div class="flex items-center gap-8 w-full">
        <!-- 两种底部：混合走长续专享人数，单一走最优折扣百分比；第二行都展示立省金额 -->
        <div class="flex flex-col gap-1.5 items-start justify-center shrink-0">
          <template v-if="footerOffMix.mixed || appliedOffPercentText">
            <div v-if="footerOffMix.mixed" class="flex items-center gap-1 whitespace-nowrap">
              <I18nT class="mixed-off-text" tag="span" :keypath="shopLabels.mixedLongRenewEnjoy" scope="global">
                <template #count>
                  <span class="mixed-off-count">{{ footerOffMix.longRenewCount }}</span>
                </template>
                <!-- 中文走折数，英/俄走 % Off，同一组插值由各语言选用 -->
                <template #discount>
                  {{ mixedLongRenewZhe }}
                </template>
                <template #off>
                  {{ footerOffMix.longRenewOff }}
                </template>
              </I18nT>
            </div>
            <div v-else class="flex items-center">
              <span class="tt-primary text-4 leading-normal">{{ $t('已享最优折扣：') }}</span>
              <span class="tt-warning text-4 font-600 leading-normal">-{{ appliedOffPercentText }}%</span>
            </div>
            <div v-if="hasFooterDiscount" class="flex items-center">
              <span class="tt-primary text-4 leading-normal">{{ $t('共计优惠：') }}</span>
              <span class="tt-warning text-4 font-600 leading-normal">{{ currency(discountAmount).format() }}</span>
            </div>
          </template>
        </div>
        <div class="flex-1 flex items-end justify-end gap-6">
          <div class="flex flex-col gap-1.5 items-end">
            <div v-if="hasFooterDiscount" class="flex items-center justify-end gap-3 tt-inactive text-4 leading-normal">
              <span>{{ $t('原价:') }}</span>
              <span class="line-through [text-decoration-skip-ink:none]">{{ currency(originalAmount).format() }}</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="price-label">
                {{ $t('总价:') }}
              </div>
              <div class="price-value">
                {{ currency(totalAmount).format() }}
              </div>
            </div>
          </div>
          <RxButton size="lg" :label="$t('确认并支付')" @click="onPay" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  background-color: var(--colors-background-bg-page);
  background-image: v-bind(bgSrc);
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: 0 0;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: 30px;
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.proxies {
  border-radius: 6px;
  border: 0.5px solid var(--colors-border-border-subtle);
  overflow: auto;
}

.radio {
  border-radius: 8px;
  border: 3px solid var(--colors-background-bg-page);
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

  &-discount {
    position: absolute;
    top: -16px;
    right: 0;
    padding: 4px 10px;
    border-radius: 9999px;
    background: #fc9d12;
    color: #fff;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 13px;
    line-height: normal;
    white-space: nowrap;
  }

  &:last-child .period-discount {
    background: var(--primitives-red-500, #f53838);
  }
}

.promo {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-block);

  &-title {
    width: fit-content;
    background: linear-gradient(
      94deg,
      var(--campaign-mayFreedom-bg-gradient-1, #4096ff) 2%,
      var(--campaign-mayFreedom-bg-gradient-2, #01cab3) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 18px;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-family: 'DingTalk JinBuTi', sans-serif;
  }

  &-hint {
    color: var(--colors-text-text-tertiary);
  }
}

.price {
  &-label {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }

  &-value {
    color: var(--colors-text-text-brand);
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }
}

.mixed-off {
  &-text {
    width: fit-content;
    background: linear-gradient(
      94deg,
      var(--campaign-mayFreedom-bg-gradient-1, #4096ff) 2%,
      var(--campaign-mayFreedom-bg-gradient-2, #01cab3) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 16px;
    font-weight: 500;
    line-height: normal;
  }

  // 人数用普通正文色，覆盖父级 background-clip 继承下来的透明填充
  &-count {
    color: var(--colors-text-text-primary);
    -webkit-text-fill-color: var(--colors-text-text-primary);
  }

  &-offer {
    background: linear-gradient(
      92.5deg,
      var(--campaign-mayFreedom-bg-gradient-1, #4096ff) 2%,
      var(--campaign-mayFreedom-bg-gradient-2, #01cab3) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 16px;
    font-weight: 500;
    line-height: normal;
  }
}
</style>
