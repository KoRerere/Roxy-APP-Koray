<script setup lang="tsx">
import { h } from 'vue'
import Duration from '/@/views/pay/subscribe/components/duration.vue'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import FreedomActivity from '/@/views/campaign/june-eighteen/activity-info.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import Profile from '/@/views/pay/subscribe/components/profile.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { addDays, format } from 'date-fns'
import { API } from '/@/api'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useResponseToast } from '/@/hooks/useResponseToast'
// import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { deepClone } from '/@/utils'
import { discountCalculate, tierCalculate } from './util'
import { OrderType, PaySubOrderType, PayWay, PurchaseType, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
import type { Plan } from './type'

const route = useRoute()
const router = useRouter()
const { seasonalActivity } = storeToRefs(useCampaignStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { getOfficialWebsite } = useSimpleLocale()
const { openProcessing, planSuccessFreedomActivity2 } = usePay()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const billingLabels = useBillingEntityLabels()

const rawList = ref<Plan[]>()
const dataList = ref<Plan[]>()

const selectedPlan = ref()
const selectedCount = ref()
const selectedDuration = ref()

const upshiftCount = computed(() => {
  if (!rawList.value)
    return selectedCount.value
  const count = Math.max(selectedCount.value, 10)
  const max = rawList.value[rawList.value.length - 1].maxWindows
  if (count < 50)
    return 50
  if (count < 100)
    return 100
  return Math.min(count + 100, max)
})

const showAlert = computed(() => {
  return selectedCount.value && currency(selectedCount.value).add(userPayInfo.value.freeWindowCount).value < userPayInfo.value.useWindowCount
})

const monthlySubscribePrice = computed(() => {
  if (selectedPlan.value?.subLevel === SubLevelEnum.Trial)
    return 0
  return tierCalculate(rawList.value!, selectedCount.value).value
})

const monthlyUpshiftPrice = computed(() => {
  if (selectedPlan.value?.subLevel === SubLevelEnum.Trial)
    return 0
  return tierCalculate(rawList.value!, upshiftCount.value).value
})

const finalDiscount = computed(() => {
  return discountCalculate([
    userPayInfo.value?.firstPurchaseDiscount,
    userPayInfo.value?.discount,
    selectedDuration.value?.discount,
  ])
})

const finalCalculate = computed(() => {
  const originalAmount = currency(monthlySubscribePrice.value, { precision: 6 }).multiply(selectedDuration.value?.month ?? 1).value
  const amount = currency(originalAmount, { precision: 6 }).multiply(finalDiscount.value).value
  const discountAmount = currency(originalAmount, { precision: 6 }).subtract(amount).value
  const amountPerMonth = currency(monthlySubscribePrice.value, { precision: 6 }).multiply(finalDiscount.value).value
  const discountAmountPerMonth = currency(monthlySubscribePrice.value, { precision: 6 }).subtract(amountPerMonth).value
  const upshiftAmountPerMonth = currency(monthlyUpshiftPrice.value, { precision: 6 }).subtract(amountPerMonth).subtract(discountAmountPerMonth).value

  return {
    amount,
    originalAmount,
    discountAmount,
    amountPerMonth,
    discountAmountPerMonth,
    upshiftAmountPerMonth,
  }
})

const isTrial = computed(() => selectedPlan.value?.subLevel === SubLevelEnum.Trial)

const currentSubscribe = computed(() => {
  const { subLevel, useWindowCount, maxWindowCount } = userPayInfo.value
  return billingLabels.value.currentPlanUsage({
    subLevel: SubLevelEnumStr[subLevel as SubLevelEnum],
    count: maxWindowCount,
    useCount: useWindowCount,
    maxCount: maxWindowCount,
  })
})

const details = computed(() => {
  // 处理试用导致显示窗口数量小于 10 的情况
  const profileCount = currency(Math.max(selectedCount.value, 10), { precision: 0, symbol: '' })
  const freeWindowCount = currency(userPayInfo.value.freeWindowCount, { precision: 0, symbol: '' })
  const { amountPerMonth, discountAmountPerMonth, upshiftAmountPerMonth } = finalCalculate.value

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: billingLabels.value.entityCount,
          value: `${profileCount.format()} + ${freeWindowCount.format()}`,
          visible: !seasonalActivity.value.freedom,
        },
        {
          label: billingLabels.value.entityCountFreeUpgrade,
          visible: seasonalActivity.value.freedom,
          slot: 'freedom',
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.add(freeWindowCount.value).multiply(30).format(),
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.add(freeWindowCount.value).multiply(100).format(),
        },
        {
          label: $t('订阅时长'),
          value: selectedDuration.value?.title,
          visible: !isTrial.value,
        },
        {
          label: $t('到期时间'),
          value: selectedDuration.value?.due,
          visible: !isTrial.value,
        },
      ].filter(item => item.visible !== false),
    },
    {
      items: [
        {
          label: $t('首购折扣'),
          class: '!color-orange',
          value: `-${userPayInfo.value?.firstPurchaseDiscount}%`,
          visible: !!userPayInfo.value?.firstPurchaseDiscount,
        },
        {
          label: $t('专属折扣'),
          class: '!color-orange',
          value: `-${userPayInfo.value?.discount}%`,
          visible: !!userPayInfo.value?.discount,
        },
        {
          label: selectedDuration.value?.discountStr || $t('订阅折扣'),
          class: '!color-orange',
          value: `-${selectedDuration.value?.discount}%`,
          visible: !isTrial.value && !!selectedDuration.value?.discount,
        },
      ].filter(item => item.visible !== false),
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(monthlySubscribePrice.value).format(),
          visible: amountPerMonth !== monthlySubscribePrice.value,
          slot: 'oldprice',
        },
        {
          label: $t('实际价格'),
          value: currency(amountPerMonth).format(),
          diffValue: discountAmountPerMonth,
          extraValue: upshiftAmountPerMonth,
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ].filter(item => item.items.length)
})

onBeforeMount(() => {
  getTierPricingList()
  mixpanelTrack('subscription_purchase_click')
})

async function getTierPricingList() {
  try {
    const { code, data, msg } = await API.pay.userGetWindowPricingRulesListList()
    if (code === 0) {
      rawList.value = deepClone(data.rows)
      // 试用套餐的 maxWindows 用于 tier 的显示，实际为最低级套餐，后续逻辑会处理
      if (!userPayInfo.value.isTrial) {
        const [first, ...rest] = data.rows
        const trial = { ...first, windowPrice: 0, maxWindows: 5, subLevel: SubLevelEnum.Trial } as Plan
        const basic = { ...first, minWindows: trial.maxWindows } as Plan
        dataList.value = [trial, basic, ...rest]
        selectedPlan.value = route.query.type === SubLevelEnum.Trial ? dataList.value![0] : dataList.value![1]
      }
      else {
        dataList.value = data.rows
        selectedPlan.value = dataList.value![0]
      }

      selectedCount.value = selectedPlan.value.maxWindows
    }
    else {
      throw new Error(msg)
    }
  }
  catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

async function onSubscribe() {
  if (selectedPlan.value.subLevel === SubLevelEnum.Trial) {
    await trialSubscribe()
    return
  }

  mixpanelTrack('click_confirm_subscribe')
  const { amount, originalAmount, discountAmount } = finalCalculate.value

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount,
        originalAmount,
        discountAmount,
        showAutoRenew: true,
        onClose: hideModal,
        onConfirm: async ({ payType, isAuto }) => {
          mixpanelTrack('click_pay_subscribe')
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            isAuto,
            payType,
            purchaseMember: {
              profile: selectedCount.value,
            },
            subLevel: selectedPlan.value.subLevel,
            subscriptionMonths: selectedDuration.value.month,
            orderType: OrderType.Subscribe,
            purchaseType: PurchaseType.Profile,
            subOrderType: PaySubOrderType.Purchase,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            (payType === PayWay.Balance ? planSuccessFreedomActivity2() : openProcessing({ payType, ...data }, OrderType.Subscribe))
              .then(() => {
                router.push({ name: 'browser-list' })
              })
          }
        },
      }),
    },
  })
}

async function trialSubscribe() {
  const { code, msg } = await API.pay.userSevenDayTrialCreate({})
  onlyErrorToast(code, msg)
  if (code === 0) {
    showToast(code, $t('成功激活试用'))
    router.push({ name: 'browser-list' })
  }
}
</script>

<template>
  <div class="overflow-auto wh-full">
    <div class="rx-container">
      <ViewsHeader :title="$route.meta.title" />
      <div class="flex flex-1 items-start gap-15 px-19.5 pt-6 pb-8 overflow-y-auto content">
        <div class="flex-1 flex flex-col gap-8">
          <Profile v-if="dataList?.length" v-model:plan="selectedPlan" v-model:count="selectedCount" class="w-full" :list="dataList" :raw-list="rawList!" />
          <FreedomActivity v-if="selectedPlan " :count="selectedCount" :upshift-count="upshiftCount" />
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <div v-show="!isTrial" class="flex flex-col gap-4">
            <div class="title">
              {{ $t('订阅时长') }}
            </div>
            <Duration v-model="selectedDuration" :price="monthlySubscribePrice" />
          </div>
          <div v-if="isTrial" class="flex items-center justify-between">
            <div class="title">
              {{ $t('订阅时长') }}
            </div>
            <div class="due">
              <div class="due-title">
                {{ $t('{day} 天', { day: userPayInfo?.trialDays }) }}
              </div>
              <div class="due-date">
                {{ format(addDays(Date.now(), userPayInfo?.trialDays), 'yyyy/MM/dd') }}
              </div>
            </div>
          </div>
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <AdvancedFeat :plan="selectedPlan" />
        </div>
        <div class="flex flex-col gap-3 w-88">
          <RxAlert class="!w-full whitespace-pre-wrap" type="info" :content="currentSubscribe" :closable="false" />
          <RxAlert v-if="showAlert" class="!w-full" type="warn" :content="billingLabels.purchaseLessThanCurrent" :closable="false" />
          <Detail :list="details">
            <template #freedom="{ item }">
              <div class="flex justify-between items-center">
                <div class="tt-secondary text-3.5 leading-5">
                  {{ item.label }}
                </div>
                <div class="flex items-center gap-1 tt-secondary text-3.5 leading-5">
                  <div>({{ selectedCount }}</div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M9.5 5.13384C10.1667 5.51874 10.1667 6.48099 9.5 6.86589L4.25 9.89698C3.58333 10.2819 2.75 9.80076 2.75 9.03095L2.75 2.96878C2.75 2.19898 3.58333 1.71785 4.25 2.10275L9.5 5.13384Z"
                      fill="url(#paint0_linear_10147_14311)"
                    />
                    <defs>
                      <linearGradient id="paint0_linear_10147_14311" x1="10" y1="1.96729" x2="9.76688" y2="10.2304" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4096FF" />
                        <stop offset="1" stop-color="#01CAB3" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div>{{ upshiftCount }})</div>
                  <div>+</div>
                  <div>{{ userPayInfo.freeWindowCount }}</div>
                </div>
              </div>
            </template>
            <template #oldprice="{ item }">
              <div class="flex justify-between">
                <div class="details-label">
                  {{ item.label }}
                </div>
                <div class="details-oldprice">
                  {{ $t('{value}/月', { value: item.value }) }}
                </div>
              </div>
            </template>
            <template #price="{ item }">
              <div class="flex flex-col gap-1.5 items-end">
                <div class="flex justify-between items-center self-stretch">
                  <div class="details-label">
                    {{ item.label }}
                  </div>
                  <div>
                    <div class="details-price">
                      <span>{{ item.value }}</span>
                      <span class="details-price-unit">{{ $t('/月') }}</span>
                    </div>
                    <div v-if="item.diffValue > 0" class="details-diffprice">
                      {{ $t('节省 {value}/月', {
                        value:
                          currency(item.diffValue).format(),
                      }) }}
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template #after>
              <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
                <RxButton size="lg" :label="$t('立即支付')" @click="onSubscribe" />
                <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                  <template #terms>
                    <a class="terms-link" :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                  </template>
                </i18n-t>
              </div>
            </template>
          </Detail>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content::-webkit-scrollbar {
  display: none;
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.due {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 20px;
    font-weight: 600;
    line-height: 20px;
  }

  &-date {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 20px;
  }
}

.details {
  &-label {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-oldprice {
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
    text-decoration-line: line-through;
  }

  &-price {
    color: #12a3fc;
    text-align: right;
    font-family: Inter;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;

    &-unit {
      font-size: 16px;
    }
  }

  &-diffprice {
    color: var(--primitives-yellow-500, #fc9d12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.freedom {
  font-family: 'DingTalk JinBuTi';
  font-size: 13px;
  background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.terms {
  color: var(--colors-text-text-tertiary, #575d60);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--colors-text-text-brand, #12a3fc);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
