<script setup lang="ts">
import LifetimeProfileModal from '/@/views/pay/wallet/components/lifetime-profile-modal.vue'
import { h } from 'vue'
import currency from 'currency.js'
import { addDays, format } from 'date-fns'
import { API } from '/@/api'
import { getImage } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useRouteContext } from '/@/composables/useRouteContext'
import type { Duration } from '/@/views/pay/subscribe/type'
import { durationTierRate, mapDurationDailyUnitPrices } from '/@/views/pay/subscribe/util'
import type { OrderType } from '/@/enums/pay'

const { price, applyNewUserGift = true, defaultDays, orderType } = defineProps<{
  /** 已叠账户折扣、未含档位 rate 的月单价 */
  price: number
  /** 为 false 时不展示新人买赠 */
  applyNewUserGift?: boolean
  /** 列表就绪后优先选中的天数，缺档则走资格默认（有买赠 90 天 / 无买赠 30 天） */
  defaultDays?: number
  /** 订单类型 */
  orderType?: OrderType
}>()
const emit = defineEmits<{
  (e: 'change', duration: Duration): void
}>()

const selectedDuration = defineModel<Duration>('modelValue')

const { isEcommerce } = useRouteContext()
const { userPayInfo } = storeToRefs(useUserStore())
const { isDarkTheme } = storeToRefs(useThemeStore())
const { windowOfferActive, benefit } = storeToRefs(useNewUserBenefitStore())
const { fetchBenefit, getWindowGiftDays } = useNewUserBenefitStore()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()

/** 窗口买赠对应「买 3 个月」档，有赠送窗口资格时默认选中 */
const WINDOW_GIFT_DEFAULT_DAYS = 90
/** 无窗口买赠资格时默认选中 30 天 */
const FALLBACK_DURATION_DAYS = 30
/** 手动点选后不再被资格异步回写覆盖 */
const userHasSelected = ref(false)
const loading = ref(false)
const durationList = ref<Duration[]>()
const maxDiscount = ref(0)

const lifetimeBgSrc = computed(() => {
  return isDarkTheme.value
    ? `url('${getImage('payments/lifetime-duration-bg-dark.png')}')`
    : `url('${getImage('payments/lifetime-duration-bg-light.png')}')`
})

/** 日单价只做展示：实付摊到购买天数 + 买赠天数；买赠不改结算 */
const dailyUnitPrice = computed(() => mapDurationDailyUnitPrices(price, durationList.value))

onBeforeMount(async () => {
  loading.value = true
  try {
    // 资格与折扣并行：避免列表先出来选中第一档，资格返回后再跳到 90 天
    if (applyNewUserGift) {
      await Promise.all([getDiscountByDuration(), fetchBenefit()])
    }
    else {
      await getDiscountByDuration()
    }
    applyWindowGift()
    applyDefaultSelection()
  }
  finally {
    loading.value = false
  }
})

/** 拉取各档折扣并生成时长卡片，不在此处选定默认档 */
async function getDiscountByDuration() {
  const { code, data, msg } = await API.pay.userGetDurationDiscountsByDaysList({ orderType })
  onlyErrorToast(code, msg)

  if (code !== 0) {
    return
  }

  durationList.value = Object.entries(data).map(([days, discount]) => {
    const day = Number(days)
    const month = currency(day).divide(30).value
    maxDiscount.value = Math.max(maxDiscount.value, discount)

    return {
      discount,
      day,
      month,
      rate: durationTierRate(day, [discount]),
      key: `day${day}`,
      title: $t('{day} 天', { day }),
      label: discount > 0 ? $t('{discount}% Off', { discount }) : day === 30 ? $t('最受欢迎') : '',
      giftDays: 0,
      due: format(addDays(userPayInfo.value.subEndDate || Date.now(), day), 'yyyy/MM/dd'),
    }
  })
}

/** 列表就绪后确定默认档：父级指定天数 > 有买赠 90 天 / 无买赠 30 天 > 第一项 */
function applyDefaultSelection() {
  if (userHasSelected.value) {
    return
  }
  const list = durationList.value
  if (!list?.length) {
    return
  }

  const eligibilityDays = applyNewUserGift && windowOfferActive.value
    ? WINDOW_GIFT_DEFAULT_DAYS
    : FALLBACK_DURATION_DAYS
  const days = defaultDays ?? eligibilityDays
  const preferred = list.find(item => item.day === days)
  selectedDuration.value = preferred ?? list[0]
}

/** 把买赠天数写进卡片与到期日；结算仍按实付天数，日单价展示会摊上赠送天数 */
function applyWindowGift() {
  durationList.value?.forEach((item) => {
    const giftDays = applyNewUserGift ? getWindowGiftDays(item.day) : 0
    item.giftDays = giftDays
    item.due = format(addDays(userPayInfo.value.subEndDate || Date.now(), item.day + giftDays), 'yyyy/MM/dd')
  })
}

watch(
  () => [applyNewUserGift, windowOfferActive.value, benefit.value.windowGiftMonths],
  () => {
    applyWindowGift()
    applyDefaultSelection()
  },
)

function onSelected(item: Duration) {
  userHasSelected.value = true
  selectedDuration.value = item
  emit('change', item)
}

/** 打开终身窗口购买弹窗（仅钱包结算），与「我的资源」入口同一套流程，不改当前订阅时长 */
function buyLifetimeProfile() {
  showModal({
    header: 'lifetime-profile-purchase',
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LifetimeProfileModal, {
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <img v-if="loading" class="block mx-auto w-8 h-8 loading-circle" src="/@/assets/icons/status/loading.png">
  <div v-else class="grid grid-cols-4 gap-col-3 gap-row-4">
    <div v-for="(item, index) in durationList" :key="index" class="relative flex flex-col gap-1 py-2.5 px-3 rounded-lg select-none cursor-pointer duration min-h-16"
         :class="{ 'active': selectedDuration?.key === item.key, 'last-duration': index === (durationList?.length ?? 0) - 1 }" @click="onSelected(item)"
    >
      <div v-if="item.label" class="absolute top-0 right-3 py-1 px-3 rounded-full -translate-y-1/2 whitespace-nowrap duration-discount" :class="{ 'max-discount': item.discount === maxDiscount }">
        {{ item.label }}
      </div>
      <div class="flex items-baseline gap-1 flex-col">
        <span class="duration-text whitespace-nowrap">{{ item.title }}</span>
        <span v-if="item.giftDays" class="duration-gift">{{ $t('{day} 天', { day: `+${item.giftDays}` }) }}</span>
      </div>
      <div v-if="dailyUnitPrice" class="tt-tertiary font-[JetBrains_Mono] text-3 font-500 leading-normal" :class="{ best: item.discount === maxDiscount }">
        {{ item.day === 1 ? $t('{price}/天', { price: dailyUnitPrice[item.day] }) : $t('低至{price}/天', { price: dailyUnitPrice[item.day] }) }}
      </div>
    </div>
    <!-- 与时长档独立：点选不改订阅天数，直接走终身窗口购买弹窗 -->
    <div v-if="!isEcommerce" class="relative col-span-2 flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 rounded-lg select-none cursor-pointer min-h-16 lifetime"
         @click="buyLifetimeProfile"
    >
      <div class="absolute top-0 right-3 py-1 px-3 rounded-full -translate-y-1/2 lifetime-label">
        {{ $t('长期最划算') }}
      </div>
      <div class="flex items-center gap-1.5">
        <SvgIcon name="base/rx_ic_infinity" size="24" />
        <span class="relative z-1 duration-text lang-zh:(text-3.75 font-500)">{{ $t('终身窗口') }}</span>
      </div>
      <div class="tt-tertiary font-[JetBrains_Mono] text-3 font-500 leading-normal">
        {{ $t('一次买断，永久使用') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.duration {
  border: 2px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &.active {
    border: 2px solid var(--colors-border-border-brand);
    background: linear-gradient(
      180deg,
      var(--pattern-pay-gradient-selected-start, #013d65) 0%,
      var(--pattern-pay-gradient-selected-end, #293038) 100%
    );
    box-shadow: none;

    .duration-text {
      white-space: nowrap;
      color: var(--pattern-pay-plan-text-plan-selected);
    }
  }

  &-discount {
    background: #fc9d12;
    color: #fff;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;

    &.max-discount {
      background: var(--primitives-red-500, #f53838);
    }
  }

  &-text {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }

  // 新人买赠天数：青绿渐变，选中态也不跟主文案变蓝
  &-gift {
    background: linear-gradient(98deg, #0dc9bd 0.26%, #02cf4a 99.74%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: normal;
  }
}

.lifetime {
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background-color: var(--colors-background-bg-action);
  background-image: v-bind(lifetimeBgSrc);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  &-label {
    color: #fff;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
    background:
      linear-gradient(
        90deg,
        var(--pattern-pay-plan-gradient-end, #11a3fd) 0%,
        var(--pattern-pay-plan-gradient-start, #ec51f7) 100%
      ),
      var(--Color-red-300, #f53838);
  }
}

.best {
  color: var(--primitives-red-500, #f53838);
}
</style>
