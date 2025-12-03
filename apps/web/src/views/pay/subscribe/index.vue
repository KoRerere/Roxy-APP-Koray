<script setup lang="tsx">
import Duration from '/@/views/pay/subscribe/components/duration.vue'
import BlackFridayDuration from '/@/views/campaign/black-friday-duration.vue'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import Profile from '/@/views/pay/subscribe/components/profile.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue';
import { RxAlert } from "/@/components/rx-alert";
import currency from 'currency.js';
import { addDays, format } from "date-fns";
import { $t } from '/@/locales'
import { API } from '/@/api'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user';
import { useSimpleLocale } from '/@/stores/locale';
import { useCampaignStore } from '/@/stores/campaign';
import { useResponseToast } from '/@/hooks/useResponseToast'
import { deepClone } from '/@/utils';
import { tierCalculate, discountCalculate } from './util'
import { OrderType, PayWay, PurchaseType, PaySubOrderType, SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay'
import { type Plan } from './type'

const route = useRoute()
const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { blackFridayPeriod } = storeToRefs(useCampaignStore())
const { getOfficialWebsite } = useSimpleLocale()
const { openProcessing, planSuccess } = usePay()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()

const rawList = ref<Plan[]>()
const dataList = ref<Plan[]>()

const selectedPlan = ref()
const selectedCount = ref()
const selectedDuration = ref()

const monthlySubscribePrice = computed(() => {
  if (selectedPlan.value?.subLevel === SubLevelEnum.Trial) return 0
  return tierCalculate(rawList.value!, selectedCount.value).value
})

const showAlert = computed(() => selectedCount.value && currency(selectedCount.value).add(userPayInfo.value.freeWindowCount).value < userPayInfo.value.useWindowCount)

const finalDiscount = computed(() => discountCalculate([userPayInfo.value?.discount, selectedDuration.value?.discount]))

const finalOriginalAmount = computed(() => currency(monthlySubscribePrice.value).multiply(selectedDuration.value?.month ?? 1).value)
const finalAmount = computed(() => currency(finalOriginalAmount.value).multiply(finalDiscount.value).value)
const finalDiscountAmount = computed(() => currency(finalOriginalAmount.value).subtract(finalAmount.value).value)

const isTrial = computed(() => selectedPlan.value?.subLevel === SubLevelEnum.Trial)

const currentSubscribe = computed(() => {
  const { subLevel, useWindowCount, maxWindowCount } = userPayInfo.value
  return $t('当前权益: {subLevel} ({count} 窗口)\n窗口用量: {useCount} / {maxCount}', { subLevel: SubLevelEnumStr[subLevel as SubLevelEnum], count: maxWindowCount, useCount: useWindowCount, maxCount: maxWindowCount })
})

const details = computed(() => {
  // 处理试用导致显示窗口数量小于 10 的情况
  const profileCount = currency(Math.max(selectedCount.value, 10), { precision: 0, symbol: '' })
  const freeWindowCount = currency(userPayInfo.value.freeWindowCount, { precision: 0, symbol: '' })
  const pricePerMonth = currency(monthlySubscribePrice.value).multiply(finalDiscount.value).value
  const discountPerMonth = currency(monthlySubscribePrice.value).subtract(pricePerMonth).value

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: $t('窗口数量'),
          value: `${profileCount.format()} + ${freeWindowCount.format()}`
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.add(freeWindowCount.value).multiply(30).format()
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.add(freeWindowCount.value).multiply(100).format()
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
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${userPayInfo.value?.discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!userPayInfo.value?.discount
        },
        {
          label: selectedDuration.value?.discountStr || $t('订阅折扣'),
          value: `-${selectedDuration.value?.discount}%`,
          class: '!color-[#FC9D12]',
          visible: !isTrial.value && !!selectedDuration.value?.discount
        },
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(monthlySubscribePrice.value).format(),
          visible: pricePerMonth !== monthlySubscribePrice.value,
          slot: 'oldprice'
        },
        {
          label: $t('实际价格'),
          value: currency(pricePerMonth).format(),
          diffValue: discountPerMonth,
          slot: 'price'
        },
      ].filter(item => item.visible !== false)
    }
  ].filter(item => item.items.length)
})

onBeforeMount(() => {
  getTierPricingList()
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
      } else {
        dataList.value = data.rows
        selectedPlan.value = dataList.value[0]
      }

      selectedCount.value = selectedPlan.value.maxWindows
    } else {
      throw new Error(msg)
    }
  } catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

async function onSubscribe() {
  if (selectedPlan.value.subLevel === SubLevelEnum.Trial) {
    await trialSubscribe()
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: finalAmount.value,
        originalAmount: finalOriginalAmount.value,
        discountAmount: finalDiscountAmount.value,
        showAutoRenew: true,
        onClose: hideModal,
        onConfirm: async ({ payType, isAuto }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            isAuto,
            payType,
            purchaseMember: {
              profile: selectedCount.value
            },
            subLevel: selectedPlan.value.subLevel,
            subscriptionMonths: selectedDuration.value.month,
            orderType: OrderType.Subscribe,
            purchaseType: PurchaseType.Profile,
            subOrderType: PaySubOrderType.Purchase,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            (payType === PayWay.Balance ? planSuccess() : openProcessing({ payType, ...data }, OrderType.Subscribe))
              .then(() => {
                router.push({ name: 'browser-list' })
              })
          }
        }
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
          <Profile class="w-full" v-if="dataList?.length" :list="dataList" :raw-list="rawList!" v-model:plan="selectedPlan" v-model:count="selectedCount"></Profile>
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)"></RxDivider>
          <div v-show="!isTrial">
            <div class="title">{{ $t('订阅时长') }}</div>
            <template v-if="blackFridayPeriod && !userPayInfo.isBlackFriday">
              <BlackFridayDuration class="mt-1" v-model="selectedDuration"></BlackFridayDuration>
              <div class="pl-2 mt-2 terms">{{ $t('* 黑色星期五优惠: 每个账户仅限购买一次。活动最终解释权归 RoxyBrowser 团队所有。') }}</div>
            </template>
            <Duration v-else class="mt-4" v-model="selectedDuration" :price="monthlySubscribePrice"></Duration>
          </div>
          <div v-if="isTrial" class="flex items-center justify-between">
            <div class="title">{{ $t('订阅时长') }}</div>
            <div class="due">
              <div class="due-title">{{ $t('{day} 天', { day: 7 }) }}</div>
              <div class="due-date">{{ format(addDays(Date.now(), 7), 'yyyy/MM/dd') }}</div>
            </div>
          </div>
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)"></RxDivider>
          <AdvancedFeat :plan="selectedPlan"></AdvancedFeat>
        </div>
        <div class="flex flex-col gap-3 w-80">
          <RxAlert class="!w-full whitespace-pre-wrap" type="info" :content="currentSubscribe" :closable="false"></RxAlert>
          <RxAlert v-if="showAlert" class="!w-full" type="warn" :content="$t('购买窗口数量少于当前窗口数')" :closable="false"></RxAlert>
          <Detail :list="details">
            <template #oldprice="{ item }">
              <div class="flex justify-between">
                <div class="details-label">{{ item.label }}</div>
                <div class="details-oldprice">{{ $t('{value}/月', { value: item.value }) }}</div>
              </div>
            </template>
            <template #price="{ item }">
              <div class="flex justify-between items-center">
                <div class="details-label">{{ item.label }}</div>
                <div>
                  <div class="details-price">
                    <span>{{ item.value }}</span>
                    <span class="details-price-unit">{{ $t('/月') }}</span>
                  </div>
                  <div v-if="item.diffValue > 0" class="details-diffprice">{{ $t('节省 {value}/月', {
                    value:
                      currency(item.diffValue).format()
                  }) }}</div>
                </div>
              </div>
            </template>
            <template #after>
              <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
                <RxButton size="lg" :label="$t('立即支付')" @click="onSubscribe"></RxButton>
                <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                  <template #terms>
                    <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
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
  color: var(--colors-text-text-primary, #FAFAFA);
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
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-oldprice {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
    text-decoration-line: line-through;
  }

  &-price {
    color: #12A3FC;
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
    color: var(--primitives-yellow-500, #FC9D12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--colors-text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
