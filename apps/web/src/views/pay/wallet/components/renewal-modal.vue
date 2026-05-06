<script setup lang="ts">
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import Duration from '/@/views/pay/subscribe/components/duration.vue'
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import currency from 'currency.js'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import { SubLevelEnum } from '/@/enums/pay'

const dialogRef = inject<any>('dialogRef')
const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const [_, onlyErrorToast] = useResponseToast()
const { getOfficialWebsite } = useSimpleLocale()
const [showModal] = useDialog()
const { showFreedomActivityModal } = useFreedomActivity()
const selectedDuration = ref()
const monthAmount = ref(0)
const loading = ref(false)

const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

const allDiscount = computed(() => {
  const { firstPurchaseDiscount, discount } = userPayInfo.value!
  const { discount: durationDiscount } = selectedDuration.value || {}

  const discounts = Object.fromEntries([
    ['firstPurchaseDiscount', firstPurchaseDiscount, true],
    ['discount', discount, true],
    ['durationDiscount', durationDiscount, !!durationDiscount],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))

  return {
    ...discounts,
    finalDiscount: discountCalculate(Object.values(discounts)),
  }
})

const disabled = computed(() => loading.value || !selectedDuration.value)

const totalAmount = computed(() => currency(monthAmount.value).multiply(selectedDuration.value?.month ?? 1).multiply(allDiscount.value.finalDiscount).value)
const originalAmount = computed(() => currency(monthAmount.value).multiply(selectedDuration.value?.month ?? 1).value)
const discountAmount = computed(() => currency(originalAmount.value).subtract(totalAmount.value).value)

const detail = computed(() => {
  const { purchaseWindowCount, freeWindowCount } = userPayInfo.value!
  const { discount, firstPurchaseDiscount, durationDiscount } = allDiscount.value

  const profileCount = currency(purchaseWindowCount, { precision: 0, symbol: '' })
  const freeCount = currency(freeWindowCount, { precision: 0, symbol: '' })

  return [
    {
      title: $t('窗口'),
      items: [
        {
          label: $t('窗口数量'),
          value: `${profileCount.format()} + ${freeCount.format()}`,
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.add(freeCount.value).multiply(30).format(),
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.add(freeCount.value).multiply(100).format(),
        },
        {
          label: $t('续费时长'),
          value: selectedDuration.value?.title,
        },
        {
          label: $t('到期时间'),
          value: selectedDuration.value?.due,
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
        {
          label: $t('专属折扣'),
          class: '!color-[#FC9D12]',
          value: `-${discount}%`,
          visible: !!discount,
        },
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
          visible: originalAmount.value !== totalAmount.value,
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
        onConfirm: async ({ payType, isAuto }) => {
          mixpanelTrack('click_pay_renew_order')
          await _onConfirm.value?.({
            payType,
            isAuto,
            orderNo: userPayInfo.value!.orderNo,
            subscriptionMonths: selectedDuration.value.month,
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
  if (isCancel)
    _onCancel.value?.()
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
      <div class="flex-1 flex flex-col gap-8">
        <ItemBlock :title="isExpired ? $t('续费套餐') : $t('当前套餐')">
          <div>
            <div class="plan">
              {{ $t('{count} 窗口', {
                count: currency(userPayInfo.purchaseWindowCount, { precision: 0, symbol: '' }).add(userPayInfo.freeWindowCount).format(),
              }) }}
            </div>
            <i18n-t tag="div" class="mt-1.5 select-none terms" :keypath="$t('若要增加窗口上限，请{terms}{text}新套餐。', { terms: '{terms}', text: '{text}' })" scope="global">
              <template #terms>
                <a class="cursor-pointer terms-link" target="_blank" @click="onUpgradePlan">{{ $t('单击此处') }}</a>
              </template>
              <template #text>
                {{ isExpired ? $t('购买') : $t('升级') }}
              </template>
            </i18n-t>
          </div>
        </ItemBlock>
        <ItemBlock :title="$t('选择续费时长')">
          <div class="flex flex-col gap-2.5">
            <Duration v-model="selectedDuration" :price="monthAmount" />
            <div v-if="!isExpired" class="help">
              {{ $t('您当前的套餐仍在有效期内，这将会延长套餐的到期时间。') }}
            </div>
          </div>
        </ItemBlock>
      </div>
      <div class="flex flex-col gap-2.5 w-88">
        <Detail :list="detail">
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
                <div v-if="discountAmount > 0" class="details-diffprice">
                  {{ $t('节省 {value}', {
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

.plan {
  color: var(--colors-text-text-primary);
  font-family: 'DingTalk JinBuTi', Inter, sans-serif;
  font-size: 32px;
  line-height: 1;
}

.help {
  color: var(--colors-text-text-inactive);
  font-family: Inter;
  font-size: 12px;
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
