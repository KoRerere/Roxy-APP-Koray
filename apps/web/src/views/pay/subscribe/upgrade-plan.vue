<script setup lang="tsx">
import ActivityInfo from '/@/views/campaign/new-year/activity-info.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import RoxyGifts from '/@/views/pay/wallet/components/roxy-gifts.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import Profile from '/@/views/pay/subscribe/components/profile.vue'
import RxButton from '/@/components/rx-button/'
import { RxAlert } from '/@/components/rx-alert/'
import { RxSvgIcon } from '/@/components/rx-icon/'
import currency from 'currency.js'
import { differenceInDays, format } from 'date-fns'
import { debounce } from 'es-toolkit'

import { API } from '/@/api'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { OrderType, PaySubOrderType, PayWay, PurchaseType, SubLevelEnumStr } from '/@/enums/pay'
import type { SubLevelEnum } from '/@/enums/pay'
import type { Plan } from './type'

const router = useRouter()
const [showModal] = RxUseDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const { getOfficialWebsite } = useSimpleLocale()
const { openProcessing, planSuccess } = usePay()
const { getUserPayInfo, mixpanelTrack } = useUserStore()
const { userPayInfo } = storeToRefs(useUserStore())
const { currentActivity } = storeToRefs(useCampaignStore())

const popupCss = useCssModule('popup')

const loading = ref(false)
const dataList = ref<Plan[]>()
const selectedPlan = ref()
const selectedCount = ref(userPayInfo.value.purchaseWindowCount)
const originalAmount = ref(0)
const needPayAmount = ref(0)
const nextBill = ref()
const giftType = ref()

const sliderMin = computed(() => userPayInfo.value.isAuto ? 10 : userPayInfo.value.purchaseWindowCount)
const isUpgrade = computed(() => selectedCount.value >= userPayInfo.value.purchaseWindowCount)

const allDiscount = computed(() => {
  const { discountPercentage: activityDiscount } = currentActivity.value
  const { firstPurchaseDiscount, discount } = userPayInfo.value!

  return Object.fromEntries([
    ['activityDiscount', activityDiscount, true],
    ['firstPurchaseDiscount', firstPurchaseDiscount, true],
    ['discount', discount, true],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))
})

const discountAmount = computed(() => currency(originalAmount.value).subtract(needPayAmount.value).value)

const currentSubscribe = computed(() => {
  const { subLevel, useWindowCount, maxWindowCount } = userPayInfo.value
  return $t('当前: {subLevel} ({count} 窗口)；用量: {useCount} / {maxCount}', { subLevel: SubLevelEnumStr[subLevel as SubLevelEnum], count: maxWindowCount, useCount: useWindowCount, maxCount: maxWindowCount })
})

const details = computed(() => {
  const { activityDiscount, firstPurchaseDiscount, discount } = allDiscount.value

  const profileCount = currency(selectedCount.value, { precision: 0, symbol: '' })
  const freeWindowCount = currency(userPayInfo.value.freeWindowCount, { precision: 0, symbol: '' })

  const { originalAmount: nextBillOriginalAmount, actualAmount: nextBillActualAmount } = nextBill.value ?? {}
  const nextBillDiscount = currency(nextBillOriginalAmount).subtract(nextBillActualAmount).value

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: $t('窗口数量'),
          value: `${profileCount.format()} + ${freeWindowCount.format()}`,
        },
        {
          label: $t('每日可创建数'),
          value: `${profileCount.add(freeWindowCount.value).multiply(30).format()}`,
        },
        {
          label: $t('每日可打开数'),
          value: `${profileCount.add(freeWindowCount.value).multiply(100).format()}`,
        },
        {
          label: $t('节日折扣'),
          class: '!color-[#FC9D12]',
          value: `-${activityDiscount}%`,
          visible: !!activityDiscount && isUpgrade.value,
        },
        {
          label: $t('首购折扣'),
          class: '!color-[#FC9D12]',
          value: `-${firstPurchaseDiscount}%`,
          visible: !!firstPurchaseDiscount,
        },
        {
          label: $t('专属折扣'),
          class: '!color-[#FC9D12]',
          value: `-${discount}%`,
          visible: !!discount,
        },
      ].filter(item => item.visible !== false),
    },
    {
      title: $t('订阅时长'),
      items: [
        {
          label: $t('生效时间'),
          value: selectedCount.value < userPayInfo.value.purchaseWindowCount ? format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') : $t('立即生效'),
        },
        {
          label: $t('到期时间'),
          value: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd'),
          visible: !userPayInfo.value.isAuto,
        },
      ].filter(item => item.visible !== false),
    },
    {
      items: [
        {
          label: $t('总差价'),
          value: currency(originalAmount.value).format(),
          visible: isUpgrade.value && originalAmount.value !== needPayAmount.value,
          slot: 'oldprice',
        },
        {
          label: $t('需付差价'),
          value: currency(needPayAmount.value).format(),
          diffValue: discountAmount.value,
          visible: isUpgrade.value,
          slot: 'price',
        },
        {
          label: $t('套餐原价'),
          value: currency(nextBillOriginalAmount).format(),
          visible: !isUpgrade.value && nextBillOriginalAmount !== nextBillActualAmount,
          slot: 'oldprice',
        },
        {
          label: $t('实际总价'),
          value: currency(nextBillActualAmount).format(),
          diffValue: nextBillDiscount,
          visible: !isUpgrade.value,
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ].filter(item => item.items.length)
})

const subInfo = computed(() => ({
  due: userPayInfo.value.isAuto ? $t('自动续订') : $t('有效期至 {date}', { date: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') }),
  days: userPayInfo.value.isAuto ? '' : $t('(剩余 {day} 天)', { day: Math.max(differenceInDays(userPayInfo.value.subEndDate, userPayInfo.value.subCurrentDate), 1) }),
}))

const getOriginalAmount = debounce(async () => {
  if (!validateWindowCount()) {
    loading.value = false
    return
  }

  if (userPayInfo.value.isAuto) {
    const { code, data, msg } = await API.pay.userGetWindowSubscriptionUpgradeMessageList({ windowCount: selectedCount.value })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    nextBill.value = data
  }

  if (selectedCount.value > userPayInfo.value.purchaseWindowCount) {
    const { code, data, msg } = await API.pay.userCalculatePriceDifferenceV2List({ purchaseMember: selectedCount.value })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    originalAmount.value = data.originalAmount
    needPayAmount.value = data.actualAmount
  }

  loading.value = false
}, 500)

watch(() => selectedCount.value, () => {
  loading.value = true
  getOriginalAmount()
})

onBeforeMount(() => {
  getTierPricingList()
  mixpanelTrack('click_enter_change_plan')
})

async function getTierPricingList() {
  try {
    const { code, data, msg } = await API.pay.userGetWindowPricingRulesListList()
    if (code === 0) {
      dataList.value = data.rows
      selectedPlan.value = dataList.value.findLast(item => userPayInfo.value.purchaseWindowCount > item.minWindows)
    }
    else {
      throw new Error(msg)
    }
  }
  catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

function validateWindowCount() {
  const { isAuto, purchaseWindowCount } = userPayInfo.value
  if (!!isAuto && selectedCount.value === purchaseWindowCount) {
    onlyErrorToast(-1, $t('订阅数量不能等于当前数量({value})', { value: purchaseWindowCount }))
    originalAmount.value = 0
    needPayAmount.value = 0
    return false
  }
  else if (!isAuto && selectedCount.value <= purchaseWindowCount) {
    onlyErrorToast(-1, $t('所选数量必须大于当前订阅数量({value})', { value: purchaseWindowCount }))
    originalAmount.value = 0
    needPayAmount.value = 0
    return false
  }
  return true
}

async function onSubscribe() {
  if (!validateWindowCount())
    return

  if (!userPayInfo.value.isAuto) {
    planUpgrade()
  }
  else if (userPayInfo.value.isAuto) {
    if (isUpgrade.value) {
      subscribeUpgrade()
    }
    else {
      subscribeDowngrade()
    }
  }
}

/**
 * 普通套餐升级
 */
async function planUpgrade() {
  mixpanelTrack('click_confirm_change_plan')
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: needPayAmount.value,
        originalAmount: originalAmount.value,
        discountAmount: discountAmount.value,
        onClose: hideModal,
        onConfirm: async ({ payType }) => {
          mixpanelTrack('click_pay_change_plan')
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            payType,
            purchaseMember: { profile: selectedCount.value },
            subLevel: selectedPlan.value.subLevel,
            isAuto: !!userPayInfo.value.isAuto,
            giftType: giftType.value,
            purchaseType: PurchaseType.Profile,
            subOrderType: PaySubOrderType.Upgrade,
            orderType: OrderType.Subscribe,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            (payType === PayWay.Balance ? planSuccess() : openProcessing({ payType, ...data }, OrderType.Subscribe))
              .then(() => {
                router.push({ name: 'browser-list' })
              })
          }
        },
      }),
    },
  })
}

/**
 * 自动续订套餐升级
 */
function subscribeUpgrade() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ handleCancel }) => {
        return (
          <div class={`flex flex-col pt-4 pb-6 px-6 gap-5 w-100 ${popupCss.header}`}>
            <div class="relative flex items-center h-9">
              <span>{$t('套餐升级提醒')}</span>
              <span class="absolute right-0 cursor-pointer" onClick={handleCancel}>
                <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
              </span>
            </div>
            <div class={`whitespace-pre-wrap ${popupCss.content}`}>{$t('您的支付信息已绑定至当前账户，点击下方按钮，系统将执行扣费操作。')}</div>
            <RxAlert class="w-full" type="info" closable={false} title={$t('操作后，新的订阅将会立即生效')}></RxAlert>
            <div class="flex justify-end gap-2">
              <RxButton outlined severity="secondary" size="md" label={$t('取消')} onClick={handleCancel}></RxButton>
              <RxButton
                size="md"
                label={$t('确认升级')}
                onClick={
                  () => {
                    handleCancel()
                    planUpgrade()
                  }
                }
              >
              </RxButton>
            </div>
          </div>
        )
      },
    },
  })
}

/**
 * 自动续订套餐降级
 */
async function subscribeDowngrade() {
  const dialogInstance = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ handleCancel }) => {
        return (
          <div class={`flex flex-col pt-4 pb-6 px-6 gap-5 w-115 ${popupCss.header}`}>
            <div class="relative flex items-center h-9">
              <span>{$t('套餐降级提醒')}</span>
              <span class="absolute right-0 cursor-pointer" onClick={handleCancel}>
                <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
              </span>
            </div>
            <div class={`whitespace-pre-wrap ${popupCss.content}`}>{$t('您选择的窗口数量少于当前套餐，确认后，新的订阅将会在下个付费周期生效。')}</div>
            <div class="flex justify-end gap-2">
              <RxButton outlined severity="secondary" size="md" label={$t('取消')} onClick={handleCancel}></RxButton>
              <RxButton size="md" label={$t('确认降级')} onClick={_onConfirm}></RxButton>
            </div>
          </div>
        )
      },
    },
  })

  async function _onConfirm() {
    const { code, msg } = await API.pay.userDowngradeSubscriptionV2List({ purchaseMember: selectedCount.value })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    dialogInstance.handleCancel()
    showToast(code, msg)
    jumpToProfile()
  }
}

function jumpToProfile() {
  getUserPayInfo()
  router.push({ name: 'browser-list' })
}
</script>

<template>
  <div class="overflow-auto wh-full">
    <div class="rx-container">
      <ViewsHeader :title="$route.meta.title" />
      <div class="flex flex-1 items-start gap-15 px-19.5 pt-6 pb-8 overflow-y-auto">
        <div class="flex-1 flex flex-col gap-8">
          <Profile v-if="dataList?.length" v-model:plan="selectedPlan" v-model:count="selectedCount" class="w-full" :list="dataList" :raw-list="dataList" :min="sliderMin" />
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <div class="flex items-center justify-between">
            <div class="sub-title">
              {{ $t('订阅时长') }}
            </div>
            <div class="due">
              <span>{{ subInfo.due }}</span>
              <span class="ml-2 due-day">{{ subInfo.days }}</span>
            </div>
          </div>
          <ActivityInfo />
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <AdvancedFeat :plan="selectedPlan" />
        </div>
        <div class="relative flex flex-col gap-3 w-88">
          <RxLoading v-model="loading" />
          <RxAlert class="!w-full whitespace-pre-wrap" type="info" :content="currentSubscribe" :closable="false" />
          <Detail :list="details">
            <template #oldprice="{ item }">
              <div class="flex justify-between">
                <div class="flex items-center gap-1.5 details-label">
                  {{ item.label }}
                </div>
                <div class="details-oldprice">
                  {{ item.value }}
                </div>
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
                    {{ $t('节省 {value}', {
                      value: currency(item.diffValue).format(),
                    }) }}
                  </div>
                </div>
              </div>
            </template>
            <template #after>
              <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
                <RoxyGifts v-model="giftType" :amount="needPayAmount" />
                <RxButton size="lg" :disabled="isUpgrade && needPayAmount === 0" :label="userPayInfo.isAuto && !isUpgrade ? $t('确认') : $t('前往支付')" @click="onSubscribe" />
                <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                  <template #terms>
                    <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                  </template>
                </i18n-t>
              </div>
            </template>
          </Detail>
          <div v-if="!loading && needPayAmount && isUpgrade && nextBill?.actualAmount" class="mt2.5 whitespace-pre-wrap next-bill">
            {{
              $t('* 下个账单费用: {bill} / {days}天\n* 下个账单生效日期: {date}', {
                bill: currency(nextBill.actualAmount).format(),
                days: nextBill.subscriptionDays,
                date: format(nextBill.payTime, 'yyyy/MM/dd'),
              }) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style module="popup" lang="scss">
.header {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.content {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 14px;
  font-weight: 400;
  line-height: 25.6px;
}
</style>

<style lang="scss" scoped>
.sub-title {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.due {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 14px;
  line-height: normal;

  &-day {
    color: var(--colors-text-text-brand, #12a3fc);
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

.next-bill {
  color: var(--colors-text-text-secondary, #b2b6b8);
  font-family: Inter;
  font-size: 14px;
  line-height: 22.4px;
}
</style>
