<script setup lang="ts">
import { PayWay } from '../enums/pay';
import { $t } from '../locales';


interface Methods {
  value: PayWay,
  [key: string]: any
}

const props = defineProps<{
  methods: Methods[],
  disabledMethods?: PayWay[],
}>()

const modelValue = defineModel<PayWay>()
const loading = defineModel<boolean>('loading', { default: false })

const defaultMethods = [
  {
    label: $t('Roxy 钱包'),
    value: PayWay.Balance,
    icon: '/images/payments/rx_payment_balance.svg'
  },
  {
    label: $t('银行卡'),
    value: PayWay.Card,
    icon: '/images/payments/rx_payment_cards.svg'
  },
  {
    label: $t('支付宝'),
    value: PayWay.Alipay,
    icon: '/images/payments/rx_payment_alipay.svg'
  },
  {
    label: $t('微信支付'),
    value: PayWay.Wechat,
    icon: '/images/payments/rx_payment_wepay.svg'
  },
  {
    label: 'USDT',
    value: PayWay.USDT,
    icon: '/images/payments/rx_payment_usdt.svg'
  }
]

const paymentMethods = computed<Record<string, any>[]>(() => {
  return props.methods.map(({ value, ...meta }) => {
    const defaultMethod = defaultMethods.find(item => item.value === value)
    return {
      ...defaultMethod,
      ...meta,
      disabled: props.disabledMethods?.includes(value)
    }
  })
})

function handleClick(method: PayWay) {
  if (props.disabledMethods?.includes(method)) {
    return
  }
  modelValue.value = method
}
</script>

<template>
  <div class="rx-payment-methods">
    <RxLoading v-model="loading" :opacity="0.6"></RxLoading>
    <template v-for="item in paymentMethods" :key="item.value">
      <div class="rx-payment-methods-item" :class="{ 'active': modelValue === item.value, 'disabled': item.disabled }"
        @click="handleClick(item.value!)">
        <div class="rx-payment-methods-item-discount" v-if="!loading && item.discount">{{ item.discount }}</div>
        <img class="h-10" :src="item.icon">
        <div>{{ item.label }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.rx-payment-methods {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(25% - 12px)), 1fr));
  gap: 12px;
  user-select: none;

  &-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 86px;
    border: 2px solid transparent;
    box-shadow: inset 0px 0px 0px 1px var(--Component-Colors-TextInput-border-border-hover, #C7CDD1);
    border-radius: 8px;
    cursor: pointer;
    color: var(--colors-text-text-primary, #FAFAFA);
    font-size: 14px;
    line-height: normal;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    &:not(.disabled).active {
      border: 2px solid var(--Color-blue-300, #12A3FC);
      background: linear-gradient(180deg, #E8F5FC 0%, #FFF 100%);
      color: var(--pattern-sidenav-text-active, #3FB6FD);
      font-weight: 600;
      box-shadow: none;
    }

    &-discount {
      position: absolute;
      right: 6px;
      top: -12px;
      padding: 3px 8px;
      border-radius: var(--radius-full, 9999px);
      background: #FC9D12;
      color: #FFF;
      font-family: "DingTalk JinBuTi";
      font-size: 12px;
      line-height: normal;
      font-weight: normal;
    }
  }
}
</style>
