<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import StripePay from '/@/views/pay/wallet/components/stripe-pay.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import { PayWay } from '/@/enums/pay'
import RxToolTip from '/@/components/rx-tooltip'

import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useConfirm } from 'primevue/useconfirm'

interface Methods {
  value: PayWay
  [key: string]: any
}

interface AvailableMethods {
  label: string
  value: PayWay[]
  image: string
  discount: number
  disabled: boolean
  getValue?: () => PayWay
  [key: string]: any
}

const { rechargeAmount, methods, disabledMethods = [], addFundsAndPay = false, onConfirm } = defineProps<{
  rechargeAmount: number
  methods: Methods[]
  disabledMethods?: PayWay[]
  addFundsAndPay?: boolean
  onConfirm: (params?: any) => any | Promise<any>
}>()

const $rechargeModal = inject<{ preventModalClose: (value?: boolean) => void }>('$rechargeModal')

const [showToast, onlyErrorToast] = useResponseToast()
const { getUserCards } = useUserStore()
const confirm = useConfirm()

const selectedPayway = defineModel<PayWay>()

const cardList = ref()
const activeCard = ref()
const openOther = ref(false)
const genStripe = ref(false)
const loading = ref(false)
const saveCard = ref(false)

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

const cryptoCoins = ref()

const defaultMethods = [
  {
    label: $t('Roxy 钱包'),
    value: [PayWay.Balance],
    image: getImage('payments/rx_payment_balance.svg'),
  },
  {
    label: 'Card',
    value: [PayWay.Card],
    image: getImage('payments/rx_payment_cards.svg'),
  },
  {
    label: $t('支付宝'),
    value: [PayWay.Alipay],
    image: getImage('payments/rx_payment_alipay.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: $t('支付宝') }),
    tip: $t('提交后将前往支付界面，请在规定的期限内完成付款。'),
  },
  {
    label: $t('微信支付'),
    value: [PayWay.Wechat],
    image: getImage('payments/rx_payment_wepay.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: $t('微信支付') }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。'),
  },
  {
    label: 'USDT/USDC',
    value: [PayWay.USDT, PayWay.USDC],
    image: getImage('payments/rx_payment_usdt_usdc.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: 'USDT/USDC' }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。'),
    getValue: () => {
      return cryptoCoins.value.find((item: any) => item.name === 'stablecoin')?.value?.value as PayWay
    },
  },
]

const confirmText = computed(() => addFundsAndPay ? $t('充值并支付') : $t('确认'))

const availableMethods = computed(() => {
  return methods.reduce((acc, { value: payway, discount, ...meta }) => {
    if (acc.some(item => item.value.includes(payway)))
      return acc

    const { label = '', value = [], image = '', getValue } = defaultMethods.find(item => item.value.includes(payway)) ?? {}

    acc.push({
      label,
      value,
      image,
      discount,
      ...meta,
      disabled: disabledMethods.includes(payway),
      getValue,
    })

    return acc
  }, [] as AvailableMethods[])
})

const chooseMethod = computed(() => defaultMethods.find(item => item.value.includes(selectedPayway.value!))!)

onBeforeMount(() => {
  getCardList()
  getCryptoCoins()
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

async function getCryptoCoins() {
  const { code, data, msg } = await API.pay.userGetStablecoinInfoList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  const coinOptions = Object.entries(data).map(([coin, chain]) => ({ label: coin, value: coin, chain })).reverse()
  const chainOptions = coinOptions[0]?.chain || []

  cryptoCoins.value = [
    {
      label: $t('选择币种'),
      name: 'stablecoin',
      value: coinOptions[0],
      props: {
        options: coinOptions,
        onChange: (data: any) => {
          selectedPayway.value = data.value.value as PayWay
          const chain = cryptoCoins.value.find((item: any) => item.name === 'chain')
          if (chain) {
            Reflect.set(chain.props, 'options', data.value.chain)
            Reflect.set(chain, 'value', data.value.chain[0])
          }
        },
      },
    },
    {
      label: $t('选择网络'),
      name: 'chain',
      value: chainOptions[0],
      props: {
        options: chainOptions,
      },
    },
  ]
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
      if (code !== 0)
        return
      getCardList()
    },
  })
}

function handleCardClick(card: any) {
  selectedPayway.value = PayWay.Card
  activeCard.value = card
  openOther.value = false
}

function handleClick(item: typeof availableMethods.value[number]) {
  if (item.disabled)
    return

  selectedPayway.value = item.getValue?.() || item.value[0]
  activeCard.value = undefined
}

function toggleOtherPay() {
  genStripe.value = true
  openOther.value = !openOther.value
  activeCard.value = openOther.value ? undefined : cardList.value?.[0]
}

async function newCardConfirm(stripeResult: any) {
  if (!saveCard.value) {
    await onConfirm(stripeResult)
    return
  }

  const { code, data, msg } = await API.pay.userBindCardCreate({ paymentMethodId: stripeResult.payment_method })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    $rechargeModal?.preventModalClose(false)
    return
  }
  await onConfirm({ ...stripeResult, ...data })
  getCardList()
}

async function payConfirm() {
  const data = { ...toRaw(activeCard.value) }
  if ([PayWay.USDT, PayWay.USDC].includes(selectedPayway.value!)) {
    const { value } = cryptoCoins.value?.find((item: any) => item.name === 'chain')!.value
    Reflect.set(data, 'chainType', value)
  }
  await onConfirm(data)
}
</script>

<template>
  <div class="relative w-full flex flex-col gap-3">
    <RxLoading v-model="loading" :opacity="0.9" />
    <div v-if="cardList?.length" class="flex self-stretch justify-between items-center px-2 gap-2 cards">
      <div class="flex py-2.5 gap-2 overflow-x-auto">
        <div v-for="item in cardList" :key="item.cardId" class="h-20 flex flex-col justify-between gap-2.5 pa-2 rounded-md cursor-pointer select-none cards-item"
             :class="{ active: activeCard?.cardId === item.cardId }" @click="handleCardClick(item)"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-1">
              <SvgIcon :name="item.cardIcon" size="32" />
              <span class="cards-item-number">({{ item.last4 }})</span>
            </div>
            <RxButton class="shrink-0" outlined severity="secondary" size="xxs" icon="base/rx_ic_bin_1" @click.stop="deleteCard(item.cardId)" />
          </div>
          <div class="flex items-center">
            <SvgIcon v-if="activeCard?.cardId === item.cardId" name="status/rx_ic_check_fill" />
            <span class="flex-1 text-right cards-item-date">{{ item.exp_month }}/{{ item.exp_year }}</span>
          </div>
        </div>
      </div>
      <div class="h-20 w-8 flex justify-center items-center cursor-pointer cards-other" @click="toggleOtherPay">
        <SvgIcon class="transition-transform duration-300" :class="{ '-rotate-45': openOther }" name="base/rx_ic_plus" />
      </div>
    </div>
    <div v-show="openOther" class="w-full grid gap-3 select-none payway">
      <template v-for="item in availableMethods" :key="item.label">
        <div class="payway-item flex items-center justify-center" :class="{ active: item.value.includes(selectedPayway!), disabled: item.disabled }" @click="handleClick(item)">
          <component :is="item.disabled ? RxToolTip : 'div'" class="relative flex flex-col items-center justify-center gap-1.5">
            <div v-if="item.discount" class="payway-item-discount">
              {{ item.discount }}
            </div>
            <img class="h-10" :src="item.image">
            <div>{{ item.label }}</div>

            <template #content>
              <span class="text-white">{{ $t('该支付方式暂时无法使用') }}</span>
            </template>
          </component>
        </div>
      </template>
    </div>
    <div v-if="genStripe" class="w-full">
      <StripePay v-show="openOther && selectedPayway === PayWay.Card" v-model:bind="saveCard" class="w-full" :recharge-amount="rechargeAmount" :confirm-text="confirmText" :on-confirm="newCardConfirm">
        <template v-if="cardList.length < 4" #after>
          <div class="flex items-center gap-2.5">
            <RxCheckbox v-model="saveCard" input-id="wrap" binary />
            <label for="wrap" class="select-none default">{{ $t('保存卡片') }}</label>
          </div>
        </template>
      </StripePay>

      <div v-show="openOther && selectedPayway !== PayWay.Card" class="flex flex-col gap-3">
        <div v-if="[PayWay.USDT, PayWay.USDC].includes(selectedPayway!) && cryptoCoins.length" class="flex gap-2.5">
          <div v-for="item in cryptoCoins" :key="item.name" class="flex-1 flex flex-col gap-1.5">
            <div class="label">
              {{ item.label }}
            </div>
            <TsFormSelect v-model="item.value" v-bind="item.props" size="lg" />
          </div>
        </div>
        <div class="flex flex-col gap-2.5 pa-4 rounded-md extend">
          <div class="flex flex-col items-start gap-1.5">
            <img class="h-8" :src="chooseMethod.image">
            <div class="extend-desc">
              {{ chooseMethod.desc }}
            </div>
          </div>
          <RxDivider line-only line-color="var(--colors-border-border-action)" />
          <div class="flex items-center gap-2.5">
            <SvgIcon name="base/rx_ic_modal" size="48" color="var(--colors-icon-icon-tertiary)" />
            <div class="extend-tip">
              {{ chooseMethod.tip }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <RxButton v-if="!openOther || (openOther && selectedPayway !== PayWay.Card)" class="w-full" size="lg" :label="confirmText" @click="payConfirm" />
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
      font-family: 'JetBrains Mono';
      font-size: 14px;
      line-height: normal;
    }

    &-date {
      color: var(--colors-text-text-tertiary);
      font-family: 'JetBrains Mono';
      font-size: 14px;
      line-height: normal;
    }
  }

  &-other {
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--colors-border-border-action);
    background: var(--colors-background-bg-action);
    box-shadow:
      0 4px 4px -1px rgba(0, 0, 0, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.06);
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
      border-radius: 9999px;
      background: #fc9d12;
      color: #fff;
      font-family: 'DingTalk JinBuTi';
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
  background: var(--colors-background-bg-block);

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

.label {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;
}
</style>
