<script setup lang="ts">
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import Duration from '/@/views/pay/subscribe/components/duration.vue'
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import ActivityInfo from '/@/views/campaign/new-user/activity-info.vue'
import ActivityInfoRenew from '/@/views/campaign/mid-autumn-festival/activity-info-renew.vue'
import currency from 'currency.js'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { discountCalculate, durationAmountFromMonthly, durationPayableAmount, hasVisiblePriceDiscount } from '/@/views/pay/subscribe/util.ts'
import { AutoRenewalStatus, OrderType, SubLevelEnum } from '/@/enums/pay'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'

const dialogRef = inject<any>('dialogRef')
const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const [_, onlyErrorToast] = useResponseToast()
const { getOfficialWebsite } = useSimpleLocale()
const [showModal] = useDialog()
const { showFreedomActivityModal } = useFreedomActivity()
const billingLabels = useBillingEntityLabels()
const selectedDuration = ref()
const monthAmount = ref(0)
const loading = ref(false)
/** 窗口订阅自动续费状态唯一，跟随当前账户状态 */
const autoRenew = ref(userPayInfo.value.isAuto)
const { beforeToggleAutoRenew } = useConfirmAutoRenew()
/** 活动入口可指定默认续费天数，缺档时 Duration 仍回落到第一项 */
const defaultDays = dialogRef.value?.data?.defaultDays as number | undefined

const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

/** 账户折扣烘进月单价后再传给时长卡；档位折扣只走 Duration.rate */
const discountedMonthly = computed(() => {
  const { firstPurchaseDiscount, discount } = userPayInfo.value!
  return currency(monthAmount.value, { precision: 6 })
    .multiply(discountCalculate([firstPurchaseDiscount, discount]))
    .value
})

const allDiscount = computed(() => {
  const { firstPurchaseDiscount, discount } = userPayInfo.value!
  const { discount: durationDiscount } = selectedDuration.value || {}

  const discounts = Object.fromEntries([
    ['firstPurchaseDiscount', firstPurchaseDiscount, true],
    ['discount', discount, true],
    ['durationDiscount', durationDiscount, !!durationDiscount],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))

  return discounts
})

const disabled = computed(() => loading.value || !selectedDuration.value)

const originalAmount = computed(() => durationAmountFromMonthly(monthAmount.value, selectedDuration.value?.day ?? 30))
const totalAmount = computed(() => durationPayableAmount(
  discountedMonthly.value,
  selectedDuration.value?.day ?? 30,
  selectedDuration.value?.rate ?? 1,
))
const discountAmount = computed(() => currency(originalAmount.value, { precision: 6 }).subtract(totalAmount.value).value)

const totalCount = computed(() => {
  const { purchaseWindowCount, freeWindowCount } = userPayInfo.value!
  const profileCount = currency(purchaseWindowCount, { precision: 0, symbol: '' })
  const freeCount = currency(freeWindowCount, { precision: 0, symbol: '' })

  return {
    profile: profileCount.format(),
    free: freeCount.format(),
    create: profileCount.add(freeCount.value).multiply(30).format(),
    open: profileCount.add(freeCount.value).multiply(100).format(),
  }
})

const detail = computed(() => {
  const { /* discount, */ firstPurchaseDiscount, durationDiscount } = allDiscount.value

  return [
    {
      title: billingLabels.value.entityUnit,
      items: [
        {
          label: billingLabels.value.entityCount,
          value: `${totalCount.value.profile} + ${totalCount.value.free}`,
        },
        {
          label: $t('每日可创建数'),
          value: totalCount.value.create,
        },
        {
          label: $t('每日可打开数'),
          value: totalCount.value.open,
        },
        {
          label: $t('续费时长'),
          slot: 'duration',
        },
        {
          label: $t('到期时间'),
          value: selectedDuration.value?.due,
        },
        {
          label: $t('自动续费'),
          slot: 'autoRenew',
        },
      ],
    },
    {
      items: [
        {
          label: $t('首购折扣'),
          class: '!color-[#FC9D12]',
          value: `-${firstPurchaseDiscount}%`,
          visible: !!firstPurchaseDiscount,
        },
        // 身份折扣文案暂不对外展示，折扣仍参与计价
        // {
        //   label: $t('专属折扣'),
        //   class: '!color-[#FC9D12]',
        //   value: `-${discount}%`,
        //   visible: !!discount,
        // },
        {
          label: selectedDuration.value?.discountStr || $t('订阅折扣'),
          class: '!color-[#FC9D12]',
          value: `-${durationDiscount}%`,
          visible: !!durationDiscount,
        },
      ].filter(item => item.visible !== false),
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(originalAmount.value).format(),
          visible: hasVisiblePriceDiscount(originalAmount.value, totalAmount.value),
          slot: 'oldprice',
        },
        {
          label: $t('实际价格'),
          value: currency(totalAmount.value).format(),
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ].filter(item => item.items.length)
})

const _onConfirm = ref()
const _onCancel = ref()

onMounted(() => {
  mixpanelTrack('subscription_renew_click')
  getMonthlyAmount()
  const { onConfirm, onCancel } = dialogRef.value.data
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})

async function getMonthlyAmount() {
  loading.value = true
  const { code, data, msg } = await API.pay.userCalculateWindowMonthsPriceList({ windowCount: userPayInfo.value.purchaseWindowCount })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code === 0) {
    monthAmount.value = data
  }
}

async function confirm() {
  mixpanelTrack('click_confirm_renew_order')
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: totalAmount.value,
        originalAmount: originalAmount.value,
        discountAmount: discountAmount.value,
        onClose: hideModal,
        onConfirm: async ({ payType }) => {
          mixpanelTrack('click_pay_renew_order')
          await _onConfirm.value?.({
            payType,
            isAuto: autoRenew.value === AutoRenewalStatus.Open,
            orderNo: userPayInfo.value!.orderNo,
            subscriptionDays: selectedDuration.value.day,
          })
          showFreedomActivityModal()
          close()
        },
      }),
    },
  })
}

function close(isCancel = false) {
  dialogRef.value.close()
  if (isCancel) {
    _onCancel.value?.()
  }
}

function onUpgradePlan() {
  if (isExpired.value) {
    router.push({ name: 'subscribe-plan' })
  }
  else {
    router.push({ name: 'upgrade-plan' })
  }
  close()
}
</script>

<template>
  <div class="pl-8 pr-6 pt-4 pb-6 popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('续费') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)" />
    </div>
    <div class="flex mt-6 gap-6">
      <div class="flex-1 flex flex-col gap-5">
        <ItemBlock :title="$t('选择续费时长')">
          <div class="flex flex-col gap-2.5">
            <Duration v-model="selectedDuration" :price="discountedMonthly" :default-days="defaultDays" :order-type="OrderType.Renew" />
            <ActivityInfo :show-proxy-price="false" />
          </div>
        </ItemBlock>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-2">
            <i18n-t tag="div" class=" tt-primary font-[DingTalk_JinBuTi] text-4 leading-normal select-none" scope="global" :keypath="$t('您当前套餐：{count} 窗口', { count: '{count}' })">
              <template #count>
                <span class="tt-brand">
                  {{ currency(userPayInfo.purchaseWindowCount, { precision: 0, symbol: '' }).add(userPayInfo.freeWindowCount).format() }}
                </span>
              </template>
            </i18n-t>
            <i18n-t tag="div" class="flex items-center tt-tertiary text-3 leading-normal"
                    :keypath="$t('每日可创建数：{create} {line} 每日可打开数：{open}', { create: '{create}', open: '{open}', line: '{line}' })"
            >
              <template #create>
                <span>
                  {{ totalCount.create }}
                </span>
              </template>
              <template #open>
                <span>
                  {{ totalCount.open }}
                </span>
              </template>
              <template #line>
                <RxDivider class="mx-3" line-only vertical />
              </template>
            </i18n-t>
            <i18n-t tag="div" class="select-none terms" :keypath="billingLabels.upgradeForMoreEntitiesKeypath" scope="global">
              <template #terms>
                <a class="cursor-pointer terms-link" target="_blank" @click="onUpgradePlan">{{ $t('单击此处') }}</a>
              </template>
              <template #text>
                {{ isExpired ? $t('购买') : $t('升级') }}
              </template>
            </i18n-t>
          </div>
          <template v-if="!isExpired">
            <RxDivider line-only line-style="dashed" />
            <div class="tt-inactive text-3 leading-normal">
              {{ $t('您当前的套餐仍在有效期内，这将会延长套餐的到期时间。') }}
            </div>
          </template>
        </div>
        <ActivityInfoRenew />
      </div>
      <div class="flex flex-col gap-2.5 w-88">
        <Detail :list="detail">
          <template #duration="{ item, classes }">
            <div class="flex justify-between" :class="classes">
              <div>{{ item.label }}</div>
              <div>
                <template v-if="selectedDuration?.giftDays">
                  {{ selectedDuration.day }}<i18n-t tag="span" class="duration-gift" :keypath="$t('{day} 天', { day: '{day}' })" scope="global">
                    <template #day>
                      + {{ selectedDuration.giftDays }}
                    </template>
                  </i18n-t>
                </template>
                <template v-else>
                  {{ selectedDuration?.title }}
                </template>
              </div>
            </div>
          </template>
          <template #autoRenew="{ classes }">
            <div class="flex items-center justify-between">
              <div :class="classes">
                {{ $t('自动续费') }}
              </div>
              <RxToggleSwitch v-model="autoRenew" :true-value="AutoRenewalStatus.Open" :false-value="AutoRenewalStatus.Close" :before-change="beforeToggleAutoRenew" />
            </div>
          </template>
          <template #oldprice="{ item }">
            <div class="flex justify-between">
              <div class="details-label">
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
                <div v-if="hasVisiblePriceDiscount(originalAmount, totalAmount)" class="details-diffprice">
                  {{ $t('立省 {value}', {
                    value: currency(discountAmount).format(),
                  }) }}
                </div>
              </div>
            </div>
          </template>
          <template #after>
            <div class="flex-1 flex flex-col justify-end mt-4 gap-3">
              <RxButton :disabled="disabled" size="lg" :label="$t('确认')" @click="confirm" />
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
</template>

<style scoped lang="scss">
.popup {
  width: clamp(960px, 72.5vw, 1024px);
}

.header {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
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

.duration-gift {
  background: linear-gradient(98deg, #0dc9bd 0.26%, #02cf4a 99.74%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
}

.terms {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 18px;

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
