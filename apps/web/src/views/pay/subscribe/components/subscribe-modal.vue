<script setup lang="tsx">
import currency from 'currency.js'
import { $t } from '/@/locales'
import { PayWay } from '/@/enums/pay'
import { discountCalculate } from '../util'
import { useUserStore } from '/@/stores/user';
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import RenewalTerms from '/@/views/pay/subscribe/components/renewal-terms.vue'
import Blance from '/@/views/pay/subscribe/components/blance.vue'

const dialogRef = inject<any>('dialogRef')
const { userPayInfo } = storeToRefs(useUserStore())

const _onConfirm = ref()
const _onCancel = ref()

const subscribeDuration = ref()
const subscribeOriginalPrice = ref()

const isAuto = ref(false)
const selectedPayway = ref(PayWay.Card)
const disabledPayWays = ref<PayWay[]>([])

const supportPayWays = computed(() => {
  return Object.values(PayWay).map((item: PayWay) => ({ value: item, discount: item === PayWay.Balance ? currency(walletAmount.value, { symbol: '-$' }).format() : 0 }))
})

const showAutoRebuy = computed(() => subscribeDuration.value?.month === 1 && [PayWay.Card].includes(selectedPayway.value))

const allDiscount = computed(() => {
  const { discount, autoRenewDiscount, walletDiscount } = userPayInfo.value!
  const { discount: durationDiscount } = subscribeDuration.value || {}
  return Object.fromEntries([
    ['discount', discount, true],
    ['autoRenewDiscount', autoRenewDiscount, showAutoRebuy.value && isAuto.value],
    ['walletDiscount', walletDiscount, selectedPayway.value === PayWay.Balance],
    ['durationDiscount', durationDiscount, !!durationDiscount],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))
})

//自动续费立减金额
const autoRenewAmount = computed(() => {
  const { autoRenewDiscount, ...otherDiscount } = allDiscount.value
  const discount: number[] = Object.values({ ...otherDiscount, autoRenewDiscount: userPayInfo.value.autoRenewDiscount })
  const _amount = currency(subscribeOriginalPrice.value).multiply(discountCalculate(discount)).value
  return currency(subscribeOriginalPrice.value).multiply(discountCalculate(Object.values(otherDiscount))).subtract(_amount).value
})

//钱包支付立减金额
const walletAmount = computed(() => {
  // 钱包暂不支持自动续费，所以需要减去 autoRenewAmount，让钱包显示正确的优惠金额
  const { walletDiscount, autoRenewDiscount, ...otherDiscount } = allDiscount.value
  const discount: number[] = Object.values({ ...otherDiscount, walletDiscount: userPayInfo.value.walletDiscount })
  const _amount = currency(subscribeOriginalPrice.value).multiply(discountCalculate(discount)).value
  return currency(subscribeOriginalPrice.value).multiply(discountCalculate(Object.values(otherDiscount))).subtract(_amount).multiply(subscribeDuration.value?.month ?? 1).value
})

const discountTooltip = computed(() => {
  const { walletDiscount, discount, durationDiscount } = allDiscount.value
  return [
    {
      label: $t('专属折扣'),
      value: `-${discount}%`,
      visible: !!discount
    },
    {
      label: $t('订阅折扣'),
      value: `-${durationDiscount}%`,
      visible: !!durationDiscount
    },
    {
      label: $t('钱包优惠'),
      value: currency(walletAmount.value, { symbol: '-$' }).format(),
      visible: !!walletDiscount
    },
    {
      label: $t('自动续订'),
      value: currency(autoRenewAmount.value, { symbol: '-$' }).format(),
      visible: showAutoRebuy.value && isAuto.value
    },
  ].filter(item => item.visible !== false).map(item => `${item.label}：${item.value}`).join('\n')
})

const calcResult = computed(() => {
  const _discount: number[] = Object.values(allDiscount.value)
  const original = currency(subscribeOriginalPrice.value).multiply(subscribeDuration.value?.month ?? 1).value
  const amount = currency(subscribeOriginalPrice.value).multiply(subscribeDuration.value?.month ?? 1).multiply(discountCalculate(_discount)).value
  const diffAmount = currency(original).subtract(amount).value

  return {
    original,
    amount,
    diffAmount
  }
})
const disabled = computed(() => selectedPayway.value === PayWay.Balance && calcResult.value.amount > userPayInfo.value?.balance)

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  subscribeOriginalPrice.value = props.subscribeOriginalPrice
  subscribeDuration.value = props.subscribeDuration
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel

  const payWayList = props.supportPayWay.concat(PayWay.Balance)
  selectedPayway.value = payWayList[0]
  disabledPayWays.value = Object.values(PayWay).filter(item => !payWayList.includes(item))
})

async function confirm() {
  await _onConfirm.value?.({
    payType: selectedPayway.value,
    isAuto: isAuto.value
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
  <div class="flex flex-col pt-4 pb-6 px-6 gap-8 popup">
    <div class="relative flex items-center h-10 header">
      <span>{{ $t('确认订阅') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)"></SvgIcon>
    </div>
    <ItemBlock :title="$t('支付方式')">
      <RxPaymentMethods v-model="selectedPayway" :methods="supportPayWays" :disabledMethods="disabledPayWays">
      </RxPaymentMethods>
    </ItemBlock>
    <ItemBlock v-if="showAutoRebuy" :title="$t('订阅选项')">
      <RenewalTerms v-model="isAuto" :discount-amount="autoRenewAmount"></RenewalTerms>
    </ItemBlock>
    <Blance v-if="selectedPayway === PayWay.Balance" :need-pay-amount="calcResult.amount" @recharge:failed="close(true)"></Blance>
    <div class="w-full border-0 border-t-0.5 border-dashed border-[#C7CDD1]"></div>
    <div class="flex flex-col gap-3 total">
      <div class="flex justify-between items-center" v-if="calcResult.diffAmount > 0">
        <div class="flex-1 total-label">{{ $t('订阅原价') }}</div>
        <div class="total-original">{{ currency(calcResult.original).format() }}</div>
      </div>
      <div class="flex justify-between items-center">
        <div class="flex-1 total-label">{{ $t('实际价格') }}</div>
        <div>
          <div class="total-amount">{{ currency(calcResult.amount).format() }}</div>
          <div class="flex items-center justify-end gap-1 total-diff" v-if="calcResult.diffAmount > 0">
            <span>{{ $t('节省 {value}', { value: currency(calcResult.diffAmount).format() }) }}</span>
            <SvgIcon v-tooltip="{ value: discountTooltip, showDelay: 300 }" class="cursor-pointer" name="base/rx_ic_question" size="14" color="#C7CDD1"></SvgIcon>
          </div>
        </div>
      </div>
    </div>
    <RxButton :disabled="disabled" size="lg" :label="$t('确认')" @click="confirm"></RxButton>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 490px;
}

.header {
  color: #000;
  font-family: Inter;
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
}

.total {
  &-label {
    color: var(--Colors-Text-text-primary, #171C1F);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-original {
    color: var(--Colors-Text-text-inactive, #A3A9AD);
    font-size: 16px;
    line-height: normal;
    text-decoration: line-through;
  }

  &-amount {
    color: var(--Color-blue-300, #12A3FC);
    text-align: right;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-diff {
    color: var(--Color-yellow-300, #FC9D12);
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}
</style>
