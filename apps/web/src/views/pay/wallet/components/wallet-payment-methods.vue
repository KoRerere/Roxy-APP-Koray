<script setup lang="ts">
import StripePay from '/@/views/pay/wallet/components/stripe-pay.vue';
import { PayWay } from '/@/enums/pay';
import { $t } from '/@/locales';
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';
import { useUserStore } from '/@/stores/user';
import { useConfirm } from 'primevue/useconfirm';

interface Methods {
  value: PayWay,
  [key: string]: any
}

const { rechargeAmount, methods = [], disabledMethods = [], onConfirm } = defineProps<{
  rechargeAmount: number,
  methods: Methods[],
  disabledMethods?: PayWay[],
  onConfirm: (params?: any) => any | Promise<any>
}>()

const [showToast, onlyErrorToast] = useResponseToast()
const { getUserCards } = useUserStore()
const confirm = useConfirm()
const modelValue = defineModel<PayWay>()
const cardList = ref()
const activeCard = ref()
const openOther = ref(false)
const firstOpen = ref(false)
const loading = ref(false)

const defaultMethods = [
  {
    label: $t('Roxy 钱包'),
    value: PayWay.Balance,
    icon: '/images/payments/rx_payment_balance.svg'
  },
  {
    label: 'Card',
    value: PayWay.Card,
    icon: '/images/payments/rx_payment_cards.svg'
  },
  {
    label: $t('支付宝'),
    value: PayWay.Alipay,
    icon: '/images/payments/rx_payment_alipay.svg',
    desc: $t('您已选择{method}作为付款方式。', { method: $t('支付宝') }),
    tip: $t('提交后，您将被重定向到一个安全页面，以完成剩余步骤。')
  },
  {
    label: $t('微信支付'),
    value: PayWay.Wechat,
    icon: '/images/payments/rx_payment_wepay.svg',
    desc: $t('您已选择{method}作为付款方式。', { method: $t('微信支付') }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。')
  },
  {
    label: 'USDT',
    value: PayWay.USDT,
    icon: '/images/payments/rx_payment_usdt.svg',
    desc: $t('您已选择{method}作为付款方式。', { method: 'USDT' }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。')
  }
]

const cardTypeMap = {
  amex: 'cards/american-express',
  bc: 'cards/bc',
  dinacard: 'cards/dinacard',
  diners: 'cards/diners-club',
  discover: 'cards/discover',
  jcb: 'cards/jcb',
  mastercard: 'cards/mastercard',
  unionpay: 'cards/union-pay',
  visa: 'cards/visa',
}

const paymentMethods = computed<Record<string, any>[]>(() => {
  return methods.map(({ value: payway, ...meta }) => {
    const { label, value, icon } = defaultMethods.find(item => item.value === payway) ?? {}
    return {
      label,
      value,
      icon,
      ...meta,
      disabled: disabledMethods.includes(payway)
    }
  })
})

onBeforeMount(() => {
  getCardList()
})

async function getCardList() {
  loading.value = true
  const data = await getUserCards(true)
  loading.value = false

  if (!data?.length) {
    toggleOtherPay()
  }
  cardList.value = data?.map(item => ({ ...item, cardIcon: cardTypeMap[item.brand as keyof typeof cardTypeMap] }))
  activeCard.value = data?.[0]
}

function deleteCard(cardId: number) {
  confirm.require({
    header: $t('删除卡片'),
    message: $t('删除后，您将无法使用该卡片进行支付。'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const { code, msg } = await API.pay.userUnbindCardCreate({ cardId })
      showToast(code, msg)
      if (code !== 0) return
      getCardList()
    }
  })
}

function handleClick(method: PayWay) {
  if (disabledMethods.includes(method)) {
    return
  }
  modelValue.value = method
  activeCard.value = undefined
}

function handleCardClick(card: any) {
  modelValue.value = PayWay.Card
  activeCard.value = card
  openOther.value = false
}

function toggleOtherPay() {
  firstOpen.value = true
  openOther.value = !openOther.value
  activeCard.value = openOther.value ? undefined : cardList.value?.[0]
}
//=============================
const saveCard = ref(false)
const chooseMethod = computed(() => defaultMethods.find(item => item.value === modelValue.value)!)

async function cardConfirm(card: any) {
  if (!saveCard.value) {
    await onConfirm(card)
    return
  }

  const { code, data, msg } = await API.pay.userBindCardCreate({ paymentMethodId: card.payment_method })
  onlyErrorToast(code, msg)
  await onConfirm({ ...card, ...data })
  if (code === 0) {
    getCardList()
  }
}

async function otherConfirm() {
  await onConfirm(toRaw(activeCard.value))
}
</script>

<template>
  <div class="relative w-full flex flex-col gap-3">
    <RxLoading v-model="loading" :opacity="0.9"></RxLoading>
    <div v-if="cardList?.length" class="flex self-stretch justify-between items-center px-2 gap-2 cards">
      <div class="flex py-2.5 gap-2 overflow-x-auto">
        <div v-for="item in cardList" :key="item.cardId" class="h-20 flex flex-col justify-between gap-2.5 pa-2 rounded-md cursor-pointer select-none cards-item"
          :class="{ 'active': activeCard?.cardId === item.cardId }" @click="handleCardClick(item)">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-1">
              <SvgIcon :name="item.cardIcon" size="32"></SvgIcon>
              <span class="cards-item-number">({{ item.last4 }})</span>
            </div>
            <RxButton class="shrink-0" outlined severity="secondary" size="xxs" icon="base/rx_ic_bin_1" @click.stop="deleteCard(item.cardId)"></RxButton>
          </div>
          <div class="flex items-center">
            <SvgIcon v-if="activeCard?.cardId === item.cardId" name="status/rx_ic_check_fill"></SvgIcon>
            <span class="flex-1 text-right cards-item-date">{{ item.exp_month }}/{{ item.exp_year }}</span>
          </div>
        </div>
      </div>
      <div class="h-20 w-8 flex justify-center items-center cursor-pointer cards-other" @click="toggleOtherPay">
        <SvgIcon class="transition-transform duration-300" :class="{ '-rotate-45': openOther }" name="base/rx_ic_plus"></SvgIcon>
      </div>
    </div>
    <div v-show="openOther" class="w-full grid gap-3 select-none payway">
      <template v-for="item in paymentMethods" :key="item.value">
        <div class="relative flex flex-col items-center justify-center gap-1.5 payway-item" :class="{ 'active': modelValue === item.value, 'disabled': item.disabled }"
          @click="handleClick(item.value!)">
          <div class="payway-item-discount" v-if="item.discount">{{ item.discount }}</div>
          <img class="h-10" :src="item.icon">
          <div>{{ item.label }}</div>
        </div>
      </template>
    </div>
    <div v-if="firstOpen" class="w-full">
      <StripePay class="w-full" v-show="openOther && modelValue === PayWay.Card" v-model:bind="saveCard" :rechargeAmount="rechargeAmount" :onConfirm="cardConfirm">
        <template #after v-if="cardList.length < 4">
          <div class="flex items-center gap-2.5">
            <Checkbox v-model="saveCard" input-id="wrap" binary />
            <label for="wrap" class="select-none default">{{ $t('保存卡片') }}</label>
          </div>
        </template>
      </StripePay>
    </div>
    <div v-if="openOther && modelValue !== PayWay.Card" class="-mt-3 flex flex-col gap-2.5 pa-4 rounded-md extend">
      <div class="flex flex-col items-start gap-1.5">
        <img class="h-8" :src="chooseMethod.icon">
        <div class="extend-desc">{{ chooseMethod.desc }}</div>
      </div>
      <RxDivider line-only line-color="var(--colors-border-border-action)"></RxDivider>
      <div class="flex items-center gap-2.5">
        <SvgIcon name="base/rx_ic_jump" size="48" color="var(--colors-icon-icon-tertiary)"></SvgIcon>
        <div class="extend-tip">{{ chooseMethod.tip }}</div>
      </div>
    </div>
    <RxButton v-if="!openOther || (openOther && modelValue !== PayWay.Card)" class="w-full" size="lg" :label="$t('确认')" @click="otherConfirm"></RxButton>
  </div>
</template>

<style scoped lang="scss">
.cards {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-page);

  &-item {
    border: 2px solid var(--colors-background-bg-page);
    box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
    background: var(--colors-background-bg-action);

    &.active {
      border: 2px solid var(--component-alert-announcement-border-success);
      box-shadow: none;
    }

    &-type {
      color: var(--colors-text-text-primary);
      font-family: Inter;
      font-size: 14px;
      font-weight: 600;
      line-height: normal;
    }

    &-number {
      color: var(--colors-text-text-tertiary);
      font-family: "JetBrains Mono";
      font-size: 14px;
      line-height: normal;
    }

    &-date {
      color: var(--colors-text-text-tertiary);
      font-family: "JetBrains Mono";
      font-size: 14px;
      line-height: normal;
    }
  }

  &-other {
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--colors-border-border-action);
    background: var(--colors-background-bg-action);
    box-shadow: 0 4px 4px -1px rgba(0, 0, 0, 0.02), 0 1px 1px 0 rgba(0, 0, 0, 0.06);
  }
}

.payway {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(25% - 12px)), 1fr));

  &-item {
    height: 86px;
    border: 2px solid var(--colors-background-bg-page);
    background: var(--colors-background-bg-action);
    box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
    border-radius: 8px;
    cursor: pointer;
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: normal;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    &:not(.disabled).active {
      border: 2px solid var(--colors-border-border-brand, #11A3FD);
      background: linear-gradient(180deg, #E8F5FC 0%, #FFF 100%);
      color: var(--pattern-sidenav-text-active, #3FB6FD);
      font-weight: 600;
      box-shadow: none;
    }

    [data-theme="dark"] &:not(.disabled).active {
      background: linear-gradient(180deg, var(--pattern-pay-gradient-selected-start, #013D65) 0%, var(--pattern-pay-gradient-selected-end, #293038) 100%);
    }

    &-discount {
      position: absolute;
      right: 6px;
      top: -12px;
      padding: 3px 8px;
      border-radius: 9999px;
      background: #FC9D12;
      color: #FFF;
      font-family: "DingTalk JinBuTi";
      font-size: 12px;
      line-height: normal;
      font-weight: normal;
    }
  }
}

.default {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
}

.extend {
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &-desc {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 14px;
    line-height: normal;
  }

  &-tip {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;
  }
}
</style>
