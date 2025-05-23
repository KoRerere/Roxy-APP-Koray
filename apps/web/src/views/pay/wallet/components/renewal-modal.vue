<script setup lang="ts">
import currency from 'currency.js'
import { addDays, format } from "date-fns";
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import { PayWay } from '/@/enums/pay';
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import Blance from '/@/views/pay/subscribe/components/blance.vue'
import Duration from '/@/views/pay/subscribe/components/duration.vue';
import Detail from '/@/views/pay/subscribe/components/detail.vue';
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale';


const dialogRef = inject<any>('dialogRef')
const { userPayInfo } = storeToRefs(useUserStore())
const [_, onlyErrorToast] = useResponseToast()
const { getOfficialWebsite } = useSimpleLocale()

const isAuto = ref(false)
const selectedDuration = ref()
const selectedPayway = ref()
const disabledMethods = ref<PayWay[]>([])
const monthAmount = ref(0)
const loading = ref(false)

const paywayList = computed(() => {
  return Object.values(PayWay)
    .map(item => ({ value: item, discount: item === PayWay.Balance ? currency(walletAmount.value, { symbol: '-$' }).format() : 0 }))
})

const allDiscount = computed(() => {
  const { discount, walletDiscount } = userPayInfo.value!
  const { discount: durationDiscount } = selectedDuration.value || {}

  return Object.fromEntries([
    ['discount', discount, true],
    ['walletDiscount', walletDiscount, selectedPayway.value === PayWay.Balance],
    ['durationDiscount', durationDiscount, !!durationDiscount],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))
})

//钱包支付立减金额
const walletAmount = computed(() => {
  // 钱包暂不支持自动续费，所以需要减去 autoRenewAmount，让钱包显示正确的优惠金额
  const { walletDiscount, autoRenewDiscount, ...otherDiscount } = allDiscount.value
  const discount: number[] = Object.values({ ...otherDiscount, walletDiscount: userPayInfo.value.walletDiscount })
  const _amount = currency(monthAmount.value).multiply(discountCalculate(discount)).value
  return currency(monthAmount.value).multiply(discountCalculate(Object.values(otherDiscount))).subtract(_amount).multiply(selectedDuration.value?.month ?? 1).value
})

const totalAmount = computed(() => currency(monthAmount.value).multiply(discountCalculate(Object.values(allDiscount.value))).multiply(selectedDuration.value?.month ?? 1).value)

const disabled = computed(() => loading.value || !selectedDuration.value || (selectedPayway.value === PayWay.Balance && totalAmount.value > userPayInfo.value?.balance))

const detail = computed(() => {
  const { purchaseWindowCount } = userPayInfo.value!
  const { discount, walletDiscount, durationDiscount } = allDiscount.value

  const originalAmount = currency(monthAmount.value).multiply(selectedDuration.value?.month ?? 1).value

  return [
    {
      title: $t('窗口'),
      items: [
        {
          label: $t('窗口数量'),
          value: purchaseWindowCount
        },
        {
          label: $t('每日可创建数'),
          value: currency(purchaseWindowCount, { precision: 0, symbol: '' }).multiply(30).format()
        },
        {
          label: $t('每日可打开数'),
          value: currency(purchaseWindowCount, { precision: 0, symbol: '' }).multiply(100).format()
        },
        {
          label: $t('续费时长'),
          value: selectedDuration.value?.title
        },
        {
          label: $t('到期时间'),
          value: format(addDays(userPayInfo.value.subEndDate || new Date(), selectedDuration.value?.day ?? 30), 'yyyy/MM/dd')
        }
      ]
    },
    {
      items: [
        {
          label: $t('专属折扣'),
          value: `-${discount}%`,
          class: '!color-[#FC9D12]',
          visible: !!discount
        },
        {
          label: $t('订阅折扣'),
          value: `-${durationDiscount}%`,
          class: '!color-[#FC9D12]',
          visible: !!durationDiscount
        },
        {
          label: $t('钱包支付优惠'),
          class: '!color-[#FC9D12]',
          value: currency(walletAmount.value, { symbol: '-$' }).format(),
          visible: !!walletDiscount
        },
      ].filter(item => item.visible !== false)
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(originalAmount).format(),
          visible: originalAmount !== totalAmount.value,
          slot: 'oldprice'
        },
        {
          label: $t('实际价格'),
          value: currency(totalAmount.value).format(),
          diffValue: currency(originalAmount).subtract(totalAmount.value).value,
          slot: 'price'
        },
      ].filter(item => item.visible !== false)
    }
  ].filter(item => item.items.length)
})

const _onConfirm = ref()
const _onCancel = ref()

onMounted(() => {
  getMonthlyAmount()
  const { onConfirm, onCancel } = dialogRef.value.data
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})

async function getMonthlyAmount() {
  loading.value = true
  const { code, data, msg } = await API.pay.userCalculateWindowMonthsPriceList({ windowCount: userPayInfo.value.purchaseWindowCount })
  loading.value = false
  if (code === 0) {
    monthAmount.value = data
    nextTick(() => {
      querySupportPayway()
    })
  }
}

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(totalAmount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) return
  const supportPayway = Object.values(data).flat().concat(PayWay.Balance) as PayWay[]
  disabledMethods.value = Object.values(PayWay).filter(item => !supportPayway.includes(item))

  if (!supportPayway.includes(selectedPayway.value)) {
    selectedPayway.value = supportPayway[0] !== PayWay.Card ? PayWay.Balance : supportPayway[0]
  }
}

function onChange() {
  nextTick(() => {
    querySupportPayway()
  })
}

async function confirm() {
  await _onConfirm.value?.({
    isAuto: isAuto.value,
    payType: selectedPayway.value,
    orderNo: userPayInfo.value!.orderNo,
    subscriptionMonths: selectedDuration.value.month
  })
  close(false)
}

function close(isCancel: boolean) {
  dialogRef.value.close()
  if (isCancel)
    _onCancel.value?.()
}
</script>

<template>
  <div class="pl-8 pr-6 pt-4 pb-6 popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('续费') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)">
      </SvgIcon>
    </div>
    <div class="flex mt-6 gap-6">
      <div class="flex-1 flex flex-col gap-8">
        <ItemBlock :title="$t('选择续费时长')">
          <Duration v-model="selectedDuration" :price="monthAmount" @change="onChange"></Duration>
        </ItemBlock>
        <ItemBlock :title="$t('选择支付方式')">
          <RxPaymentMethods v-model="selectedPayway" :loading="loading" :methods="paywayList"
            :disabledMethods="disabledMethods"></RxPaymentMethods>
        </ItemBlock>
        <Blance v-if="selectedPayway === PayWay.Balance" :need-pay-amount="totalAmount"></Blance>
      </div>
      <Detail class="w-90" :list="detail">
        <template #oldprice="{ item }">
          <div class="flex justify-between">
            <div class="details-label">{{ item.label }}</div>
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
          <div class="flex-1 flex flex-col justify-end mt-4">
            <RxButton :disabled="disabled" size="lg" :label="$t('确认')" @click="confirm"></RxButton>
            <i18n-t tag="div" class="mt-3 select-none terms"
              :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
              <template #terms>
                <a class="terms-link" :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
              </template>
            </i18n-t>
          </div>
        </template>
      </Detail>
    </div>
  </div>
</template>

<style scoped lang="scss">
.popup {
  width: 1024px;
}

.header {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
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
    color: var(--colors-text-text-tertiary, #8A9093);
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
    color: var(--Color-yellow-300, #FC9D12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-tertiary, #8A9093);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  &-link {
    color: var(--Colors-Text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
