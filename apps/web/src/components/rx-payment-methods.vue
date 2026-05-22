<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { PayWay } from '../enums/pay'
import { $t } from '../locales'

interface Methods {
  value: PayWay
  [key: string]: any
}

const props = defineProps<{
  methods: Methods[]
  disabledMethods?: PayWay[]
}>()

const modelValue = defineModel<PayWay>()
const loading = defineModel<boolean>('loading', { default: false })

const defaultMethods = [
  {
    label: $t('Roxy 钱包'),
    value: PayWay.Balance,
    icon: getImage('payments/rx_payment_balance.svg'),
  },
  {
    label: 'Card',
    value: PayWay.Card,
    icon: getImage('payments/rx_payment_cards.svg'),
  },
  {
    label: $t('支付宝'),
    value: PayWay.Alipay,
    icon: getImage('payments/rx_payment_alipay.svg'),
  },
  {
    label: $t('微信支付'),
    value: PayWay.Wechat,
    icon: getImage('payments/rx_payment_wepay.svg'),
  },
  {
    label: 'USDT',
    value: PayWay.USDT,
    icon: getImage('payments/rx_payment_usdt.svg'),
  },
  {
    label: 'PayPal',
    value: PayWay.PayPal,
    icon: getImage('payments/rx_payment_paypal.svg'),
  },
]

const paymentMethods = computed<Record<string, any>[]>(() => {
  return props.methods.map(({ value, ...meta }) => {
    const defaultMethod = defaultMethods.find(item => item.value === value)
    return {
      ...defaultMethod,
      ...meta,
      disabled: props.disabledMethods?.includes(value),
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
  <div class="relative w-full grid grid-cols-3 gap-3 select-none">
    <RxLoading v-model="loading" :opacity="0.6" />
    <template v-for="item in paymentMethods" :key="item.value">
      <div class="rx-payment-methods-item" :class="{ active: modelValue === item.value, disabled: item.disabled }" @click="handleClick(item.value!)">
        <div v-if="!loading && item.discount" class="rx-payment-methods-item-discount">
          {{ item.discount }}
        </div>
        <img class="h-10" :src="item.icon">
        <div>{{ item.label }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.rx-payment-methods {
  &-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 86px;
    border: 2px solid var(--colors-background-bg-page);
    background: var(--colors-background-bg-action);
    box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action, #48555b);
    border-radius: 8px;
    cursor: pointer;
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 14px;
    line-height: normal;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    &:not(.disabled).active {
      border: 2px solid var(--colors-border-border-brand, #11a3fd);
      background: linear-gradient(180deg, #e8f5fc 0%, #fff 100%);
      color: var(--pattern-sidenav-text-active, #3fb6fd);
      font-weight: 600;
      box-shadow: none;
    }

    [data-theme='dark'] &:not(.disabled).active {
      background: linear-gradient(
        180deg,
        var(--pattern-pay-gradient-selected-start, #013d65) 0%,
        var(--pattern-pay-gradient-selected-end, #293038) 100%
      );
    }

    &-discount {
      position: absolute;
      right: 6px;
      top: -12px;
      padding: 3px 8px;
      border-radius: var(--radius-full, 9999px);
      background: #fc9d12;
      color: #fff;
      font-family: 'DingTalk JinBuTi';
      font-size: 12px;
      line-height: normal;
      font-weight: normal;
    }
  }
}
</style>
