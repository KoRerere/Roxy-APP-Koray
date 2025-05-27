<script setup lang="tsx">
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxButton from '/@/components/rx-button/'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import SubscribeModal from './components/subscribe-modal.vue'
import Profile from '/@/views/pay/subscribe/components/profile.vue'
import currency from 'currency.js';
import { format, differenceInDays } from 'date-fns'
import { debounce } from 'es-toolkit'
import { useDialog } from 'primevue/usedialog'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert/'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { tierCalculate, discountCalculate } from './util'
import { OrderType, PayWay, PurchaseType, PaySubOrderType } from '/@/enums/pay'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useUserStore } from '/@/stores/user';
import { type Plan } from './type'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
const router = useRouter()
const dialog = useDialog()
const [showModal] = RxUseDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const { openProcessing, planSuccess } = usePay()
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()

const popupCss = useCssModule('popup')
const { getOfficialWebsite } = useSimpleLocale()

const loading = ref(false)
const dataList = ref<Plan[]>()
const selectedPlan = ref()
const selectedCount = ref(userPayInfo.value.purchaseWindowCount)
const originalAmount = ref(0)

const sliderMin = computed(() => userPayInfo.value.isAuto ? 10 : userPayInfo.value.purchaseWindowCount)
const isUpgrade = computed(() => selectedCount.value >= userPayInfo.value.purchaseWindowCount)
const needPayAmount = computed(() => currency(originalAmount.value).multiply(discountCalculate([userPayInfo.value.discount])).value)
const nextBill = computed(() => {
  const { isAuto, discount, autoRenewDiscount, purchaseWindowCount } = userPayInfo.value
  if (!isAuto || !dataList.value || purchaseWindowCount === selectedCount.value) return { original: 0, amount: 0, discount: 0 }

  const { value } = tierCalculate(dataList.value!, selectedCount.value)
  const _discount = discountCalculate([discount, autoRenewDiscount])
  const amount = currency(value).multiply(_discount).value
  return {
    original: value,
    amount,
    discount: currency(value).subtract(amount).value
  }
})
const details = computed(() => {
  const { discount } = userPayInfo.value

  const profileCount = currency(selectedCount.value, { precision: 0, symbol: '' })


  const { original: nextBillOriginal, amount: nextBillAmount, discount: nextBillDiscount } = nextBill.value

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: $t('窗口数量'),
          value: profileCount.format()
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.multiply(30).format()
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.multiply(100).format()
        },
        {
          label: $t('专属折扣'),
          value: `-${discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!discount
        },
      ].filter(item => item.visible !== false)
    },
    {
      title: $t('订阅时长'),
      items: [
        {
          label: $t('生效时间'),
          value: selectedCount.value < userPayInfo.value.purchaseWindowCount ? format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') : $t('立即生效')
        },
        {
          label: $t('到期时间'),
          value: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd'),
          visible: !userPayInfo.value.isAuto
        },
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('总差价'),
          value: currency(originalAmount.value).format(),
          visible: isUpgrade.value && originalAmount.value !== needPayAmount.value,
          slot: 'oldprice'
        },
        {
          label: $t('需付差价'),
          value: currency(needPayAmount.value).format(),
          diffValue: currency(originalAmount.value).subtract(needPayAmount.value).value,
          visible: isUpgrade.value,
          slot: 'price'
        },
        {
          label: $t('套餐原价'),
          value: currency(nextBillOriginal).format(),
          visible: !isUpgrade.value && nextBillOriginal !== nextBillAmount,
          slot: 'oldprice'
        },
        {
          label: $t('实际总价'),
          value: currency(nextBillAmount).format(),
          diffValue: nextBillDiscount,
          visible: !isUpgrade.value,
          slot: 'price'
        },
      ].filter(item => item.visible !== false)
    }
  ].filter(item => item.items.length)
})

const getOriginalAmount = debounce(async () => {
  if (!validateWindowCount()) {
    loading.value = false
    return
  }
  const { code, data, msg } = await API.pay.userCalculatePriceDifferenceList({
    purchaseMember: selectedCount.value,
    source: !!userPayInfo.value.isAuto ? 'AutoRenew' : 'Fixed'// 自动续订：AutoRenew，固定套餐：Fixed
  })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) return
  originalAmount.value = data
}, 500)

watch(() => selectedCount.value, () => {
  if (selectedCount.value < userPayInfo.value.purchaseWindowCount) return
  loading.value = true
  getOriginalAmount()
})

onBeforeMount(() => {
  getTierPricingList()
})

async function getTierPricingList() {
  try {
    const { code, data, msg } = await API.pay.userGetWindowPricingRulesListList()
    if (code === 0) {
      dataList.value = data.rows
      selectedPlan.value = dataList.value.findLast(item => userPayInfo.value.purchaseWindowCount > item.minWindows)
    } else {
      throw new Error(msg)
    }
  } catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

function validateWindowCount() {
  const { isAuto, purchaseWindowCount } = userPayInfo.value
  if (!!isAuto && selectedCount.value === purchaseWindowCount) {
    onlyErrorToast(-1, $t('订阅数量不能等于当前数量({value})', { value: purchaseWindowCount }))
    originalAmount.value = 0
    return false
  } else if (!isAuto && selectedCount.value <= purchaseWindowCount) {
    onlyErrorToast(-1, $t('所选数量必须大于当前订阅数量({value})', { value: purchaseWindowCount }))
    originalAmount.value = 0
    return false
  }
  return true
}

async function onSubscribe() {
  if (!validateWindowCount()) return

  if (!userPayInfo.value.isAuto) {
    planUpgrade()
  } else if (userPayInfo.value.isAuto) {
    if (isUpgrade.value) {
      subscribeUpgrade()
    } else {
      subscribeDowngrade()
    }
  }
}

// 普通套餐升级
async function planUpgrade() {
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(originalAmount.value) })
  onlyErrorToast(code, msg)
  if (code !== 0) return

  dialog.open(SubscribeModal, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0'
      }
    },
    data: {
      props: {
        subscribeOriginalPrice: toRaw(originalAmount.value),
        supportPayWay: Object.values(data).flat()
      },
      onConfirm: async (params: { isAuto: boolean, payType: PayWay }) => {
        const { code, data, msg } = await API.pay.userPaySettlementCreate({
          purchaseMember: { profile: selectedCount.value },
          purchaseType: PurchaseType.Profile,
          subLevel: selectedPlan.value.subLevel,
          subOrderType: PaySubOrderType.Upgrade,
          ...params,
          orderType: OrderType.Subscribe,
        })
        onlyErrorToast(code, msg)
        if (code === 0) {
          (params.payType === PayWay.Balance ? planSuccess() : openProcessing({ payType: params.payType, ...data }, OrderType.Subscribe))
            .then(() => {
              router.push({ name: 'browser-list' })
            })
        }
      },
    },
  })
}

// 自动续订套餐升级
function subscribeUpgrade() {
  const dialogInstance = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ handleCancel }) => {
        return <div class={`flex flex-col pt-4 pb-6 px-6 gap-5 w-100 ${popupCss.header}`}>
          <div class="relative flex items-center h-9">
            <span>{$t('套餐升级提醒')}</span>
            <span class="absolute right-0 cursor-pointer" onClick={handleCancel}>
              <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
            </span>
          </div>
          <div class={`whitespace-pre-wrap ${popupCss.content}`}>{$t('您的支付信息已绑定至当前账户，点击下方按钮，系统将执行扣费操作。')}</div>
          <RxAlert class="w-full" type="info" closable={false} title={$t('操作后，新的订阅将会立即生效')}></RxAlert>
          <div class="flex justify-end gap-2">
            <RxButton outlined severity='secondary' size='md' label={$t('取消')} onClick={handleCancel}></RxButton>
            <RxButton size='md' label={$t('确认升级')} onClick={_onConfirm}></RxButton>
          </div>
        </div>
      }
    },
  })

  async function _onConfirm() {
    const { code, msg } = await API.pay.userAutoRenewUpgradeList({ purchaseMember: selectedCount.value })
    onlyErrorToast(code, msg)
    dialogInstance.handleCancel()
    if (code !== 0) return
    showToast(code, msg)
    jumpToProfile()
  }
}

// 自动续订套餐降级
async function subscribeDowngrade() {
  const dialogInstance = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ handleCancel }) => {
        return <div class={`flex flex-col pt-4 pb-6 px-6 gap-5 w-115 ${popupCss.header}`}>
          <div class="relative flex items-center h-9">
            <span>{$t('套餐降级提醒')}</span>
            <span class="absolute right-0 cursor-pointer" onClick={handleCancel}>
              <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
            </span>
          </div>
          <div class={`whitespace-pre-wrap ${popupCss.content}`}>{$t('您选择的窗口数量少于当前套餐，确认后，新的订阅将会在下个付费周期生效。')}</div>
          <RxAlert class="w-full" type="warn" closable={false} title={$t('操作后，套餐订阅状态在下个付费周期前无法再次修改。')}></RxAlert>
          <div class="flex justify-end gap-2">
            <RxButton outlined severity='secondary' size='md' label={$t('取消')} onClick={handleCancel}></RxButton>
            <RxButton size='md' label={$t('确认降级')} onClick={_onConfirm}></RxButton>
          </div>
        </div>
      }
    },
  })

  async function _onConfirm() {
    const { code, msg } = await API.pay.userDowngradeSubscriptionList({ purchaseMember: selectedCount.value })
    onlyErrorToast(code, msg)
    if (code !== 0) return
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
  <div class="flex flex-col w-full h-full">
    <ViewsHeader :title="$route.meta.title" />
    <div class="rx-container">
      <div class="flex flex-1 items-start gap-15 px-19.5 pt-6 overflow-y-auto">
        <div class="flex-1">
          <Profile class="w-full" v-if="dataList?.length" v-model:plan="selectedPlan" v-model:count="selectedCount" :list="dataList" :min="sliderMin"></Profile>
          <div class="flex items-center justify-between py-8 border-0 border-t border-dashed border-[var(--colors-border-divider-dashed)]" v-if="dataList?.length">
            <div class="sub-title">{{ $t('订阅时长') }}</div>
            <div v-if="userPayInfo.isAuto" class="due">{{ $t('自动续订') }}</div>
            <div v-else class="due">
              <span>{{ $t('截止至 {date}', { date: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</span>
              <span class="ml-2 due-day">{{ $t('(剩余 {day} 天)', {
                day: Math.max(differenceInDays(userPayInfo.subEndDate, userPayInfo.subCurrentDate), 1)
              }) }}</span>
            </div>
          </div>
          <AdvancedFeat :plan="selectedPlan" class="py-8 border-0 border-t border-dashed border-[var(--colors-border-divider-dashed)]">
          </AdvancedFeat>
        </div>
        <div class="relative w-88">
          <RxLoading v-model="loading"></RxLoading>
          <Detail :list="details">
            <template #oldprice="{ item }">
              <div class="flex justify-between">
                <div class="flex items-center gap-1.5 details-label">
                  <span>{{ item.label }}</span>
                  <!-- <SvgIcon v-tooltip.top="{ value: $t('例：A套餐总时长180天'), showDelay: 300 }" class="cursor-pointer" name="base/rx_ic_info" color="#A3A9AD" size="14"></SvgIcon> -->
                </div>
                <div class="details-oldprice">{{ item.value }}</div>
              </div>
            </template>
            <template #price="{ item }">
              <div class="flex justify-between items-center">
                <div class="details-label">{{ item.label }}</div>
                <div>
                  <div class="details-price">{{ item.value }}</div>
                  <div v-if="item.diffValue > 0" class="details-diffprice">{{ $t('节省 {value}', {
                    value:
                      currency(item.diffValue).format()
                  }) }}</div>
                </div>
              </div>
            </template>
            <template #after>
              <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
                <RxButton size="lg" :disabled="isUpgrade && needPayAmount === 0" :label="userPayInfo.isAuto && !isUpgrade ? $t('确认') : $t('前往支付')" @click="onSubscribe"></RxButton>
                <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
                  <template #terms>
                    <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议')
                    }}</a>
                  </template>
                </i18n-t>
              </div>
            </template>
          </Detail>
          <div v-if="!loading && needPayAmount && isUpgrade && nextBill.amount" class="mt2.5 whitespace-pre-wrap next-bill">{{
            $t('* 下个账单费用: {bill}\n* 下个账单生效日期: {date}', {
              bill: currency(nextBill.amount).format(),
              date: format(userPayInfo.subEndDate, 'yyyy/MM/dd')
            }) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style module="popup" lang="scss">
.header {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.content {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 14px;
  font-weight: 400;
  line-height: 25.6px;
}
</style>

<style lang="scss" scoped>
.sub-title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.due {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 14px;
  line-height: normal;

  &-day {
    color: var(--colors-text-text-brand, #12A3FC);
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

.next-bill {
  color: var(--colors-text-text-secondary, #B2B6B8);
  font-family: Inter;
  font-size: 14px;
  line-height: 22.4px;
}
</style>
