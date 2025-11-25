<script setup lang="ts">
import { loadStripe, type Stripe, type StripeElements, type StripeCardNumberElement, type StripeCardExpiryElement, type StripeCardCvcElement } from '@stripe/stripe-js'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'
import { $t } from '/@/locales';
import { PayWay } from '/@/enums/pay';
import { useThemeStore } from '/@/stores/theme'

const { confirmText = $t('确认'), rechargeAmount = 0, onConfirm } = defineProps<{
  rechargeAmount?: number,
  confirmText?: string
  onConfirm: (stripeResult: any) => void | Promise<void>
}>()

const bindCard = defineModel<boolean>('bind', { default: false })

const [_, onlyErrorToast] = useResponseToast()
const { realTheme } = storeToRefs(useThemeStore())

// Stripe 相关变量
let elements: StripeElements | null = null
let cardNumber: StripeCardNumberElement | null = null
let cardExpiry: StripeCardExpiryElement | null = null
let cardCvc: StripeCardCvcElement | null = null

// DOM 引用
const cardNumberElement = ref<HTMLElement>()
const cardExpiryElement = ref<HTMLElement>()
const cardCvcElement = ref<HTMLElement>()

const stripe = ref<Stripe | null>()
const publishableKey = ref()
const bindCardClientSecret = ref()
const customerIdKey = ref()
const isLoading = ref(false)
const initLoading = ref(false)

onMounted(async () => {
  initLoading.value = true
  await getStripeKey()
  await nextTick()
  initStripeElements()
  console.log('stripe:', stripe.value)
  initLoading.value = false
})

onBeforeUnmount(() => {
  cardNumber?.unmount()
  cardExpiry?.unmount()
  cardCvc?.unmount()
})

const cssVar = (name: string) => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
};

async function getStripeKey() {
  const { code, data, msg } = await API.pay.userGetStripePkKeyList({ queryType: '0' })// 0 卡片绑定 1卡片支付, 1暂时没用到
  onlyErrorToast(code, msg)
  if (code !== 0) return
  stripe.value = await loadStripe(data.stripe_pk_key)
  publishableKey.value = data.stripe_pk_key
  bindCardClientSecret.value = data.client_secret
  customerIdKey.value = data.customer_id_key
}

function initStripeElements() {
  if (!stripe.value) {
    onlyErrorToast(-1, 'stripe initialization failed, please check stripe key configuration!')
    return
  }

  elements = stripe.value.elements()
  // 自定义样式
  const style = {
    base: {
      'color': cssVar('--colors-text-text-primary'),
      'fontFamily': '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
      'fontSmoothing': 'antialiased',
      'fontSize': '14px',
      '::placeholder': {
        color: cssVar('--colors-text-text-inactive'),
      },
    },
    invalid: {
      color: cssVar('--colors-text-text-error'),
      iconColor: cssVar('--colors-text-text-error'),
    },
    complete: {
      color: cssVar('--colors-text-text-success'),
      iconColor: cssVar('--colors-text-text-success'),
    },
  }

  // 创建分离的 Elements
  cardNumber = elements.create('cardNumber', { style, showIcon: true })// 卡号
  cardExpiry = elements.create('cardExpiry', { style })// 有效期
  cardCvc = elements.create('cardCvc', { style })// CVC码

  // 挂载到对应的容器
  if (cardNumberElement.value) {
    cardNumber.mount('#card-number-element')
    cardNumber.on('change', handleElementChange)
  }
  if (cardExpiryElement.value) {
    cardExpiry.mount('#card-expiry-element')
    cardExpiry.on('change', handleElementChange)
  }
  if (cardCvcElement.value) {
    cardCvc.mount('#card-cvc-element')
    cardCvc.on('change', handleElementChange)
  }
}

function handleElementChange({ error }: any) {
  if (error) {
    console.log(error.message)
  }
}

async function handleSubmit(event: Event) {
  event.preventDefault()

  if (!stripe.value || !cardNumber) {
    onlyErrorToast(-1, 'stripe initialization failed, please check stripe key configuration!')
    return
  }

  isLoading.value = true

  try {
    const { error, result } = bindCard.value ? await stripeBindCard() : await stripePayment()
    if (error) {
      throw error.message
    }
    console.log('Stripe success:', result)
    await onConfirm(result)
    // 重置表单
    cardNumber.clear()
    cardExpiry?.clear()
    cardCvc?.clear()
  } catch (error: any) {
    onlyErrorToast(-1, error)
  } finally {
    isLoading.value = false
  }
}

async function stripeBindCard() {
  const { error, setupIntent } = await stripe.value!.confirmCardSetup(bindCardClientSecret.value, {
    payment_method: {
      card: cardNumber!,
    },
  })

  return { error, result: setupIntent }
}

async function stripePayment() {
  const { code, data, msg } = await API.pay.userRechargeSettlementCreate({
    rechargeAmount,
    payType: PayWay.Card,
    customerIdKey: customerIdKey.value,
  })
  if (code !== 0) return { error: new Error(msg), result: undefined }

  const { error, paymentIntent } = await stripe.value!.confirmCardPayment(data.clientSecret, {
    payment_method: {
      card: cardNumber!,
    },
  })

  return { error, result: { ...paymentIntent, _PRE_ORDER: { code, data, msg } } }
}
</script>

<template>
  <form class="relative flex flex-col gap-3" @submit="handleSubmit">
    <RxLoading v-model="initLoading" :opacity="0.9"></RxLoading>
    <div class="flex flex-col gap-1.5">
      <label class="form-label" for="card-number-element">{{ $t('卡号') }}</label>
      <div id="card-number-element" ref="cardNumberElement"><!-- Stripe Elements 卡号输入框 --></div>
    </div>
    <div class="flex items-end gap-3">
      <div class="flex-1 flex flex-col gap-1.5">
        <label class="form-label" for="card-expiry-element">{{ $t('有效期') }}</label>
        <div id="card-expiry-element" ref="cardExpiryElement"><!-- Stripe Elements 有效期输入框 --></div>
      </div>
      <div class="flex-1 flex flex-col gap-1.5">
        <label class="form-label" for="card-cvc-element">CVC</label>
        <div id="card-cvc-element" ref="cardCvcElement"><!-- Stripe Elements CVC输入框 --></div>
      </div>
    </div>
    <RxButton class="mt-1 w-full" type="submit" size="lg" :loading="isLoading" :label="confirmText"></RxButton>
    <slot name="after"></slot>
    <div class="flex items-center justify-between gap-2">
      <span class="tip">{{ $t('*我们不会存储您的完整卡号或敏感信息。') }}</span>
      <img v-if="realTheme === 'dark'" class="block h-5" src="/images/payments/stripe-blurple-dark.svg">
      <img v-else class="block h-5" src="/images/payments/stripe-blurple.svg">
    </div>
  </form>
</template>

<style lang="scss" scoped>
.tip {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 20px;
}

.form-label {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  line-height: normal;
}

#card-number-element,
#card-expiry-element,
#card-cvc-element {
  height: 40px;
  padding: 10px 10px 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--colors-border-border-brand);
  }
}

/* Stripe元素样式定制 */
.StripeElement {
  box-sizing: border-box;
  height: 56px;
  padding: 16px;
  background-color: transparent;
}

#card-number-element .StripeElement--focus,
#card-expiry-element .StripeElement--focus,
#card-cvc-element .StripeElement--focus {
  outline: none;
}

#card-number-element.StripeElement--focus,
#card-expiry-element.StripeElement--focus,
#card-cvc-element.StripeElement--focus {
  border-color: var(--colors-border-border-brand);
}

#card-number-element.StripeElement--invalid,
#card-expiry-element.StripeElement--invalid,
#card-cvc-element.StripeElement--invalid {
  border-color: var(--colors-border-border-error);
}

#card-number-element.StripeElement--complete,
#card-expiry-element.StripeElement--complete,
#card-cvc-element.StripeElement--complete {
  border-color: var(--component-alert-announcement-border-success);
}
</style>
