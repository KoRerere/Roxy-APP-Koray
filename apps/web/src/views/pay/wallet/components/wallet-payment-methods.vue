<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import StripePay from '/@/views/pay/wallet/components/stripe-pay.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import { PayWay } from '/@/enums/pay'
import RxToolTip from '/@/components/rx-tooltip'
import { PAYWAY_ALL_CATEGORY } from '/@/views/pay/wallet/components/payway-category'

import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useConfirm } from 'primevue/useconfirm'

interface Methods {
  value: PayWay
  /** 接口返回的支付分类，如 USD / CNY / Crypto */
  category?: string
  [key: string]: any
}

interface AvailableMethods {
  label: string
  value: PayWay[]
  image: string
  discount: number
  disabled: boolean
  category?: string
  getValue?: () => PayWay
  [key: string]: any
}

/** 3 列 × 4 行；超出时最后一格留给「更多」所以默认只露出 11 个 */
const GRID_COLUMNS = 3
const MAX_COLLAPSED_ROWS = 4
const COLLAPSED_SLOTS = GRID_COLUMNS * MAX_COLLAPSED_ROWS
const COLLAPSED_ITEM_COUNT = COLLAPSED_SLOTS - 1

const { rechargeAmount, methods, disabledMethods = [], addFundsAndPay = false, category = PAYWAY_ALL_CATEGORY, onConfirm } = defineProps<{
  rechargeAmount: number
  methods: Methods[]
  disabledMethods?: PayWay[]
  addFundsAndPay?: boolean
  /** 当前分类，All 表示不过滤 */
  category?: string
  onConfirm: (params?: any) => any | Promise<any>
}>()

const $rechargeModal = inject<{ preventModalClose: (value?: boolean) => void }>('$rechargeModal')

const [showToast, onlyErrorToast] = useResponseToast()
const { getUserCards } = useUserStore()
const { isDarkTheme } = storeToRefs(useThemeStore())
const confirm = useConfirm()

/** 浅色稿深描边、深色稿白描边；无 dark 资源时沿用浅色 */
function resolvePayImage(method?: { image?: string, imageDark?: string }) {
  if (isDarkTheme.value && method?.imageDark)
    return method.imageDark
  return method?.image ?? ''
}

/** 支付方式图标统一放在 payments/{light|dark}/，按主题切换 */
function themedPayIcon(file: string) {
  return {
    image: getImage(`payments/light/${file}`),
    imageDark: getImage(`payments/dark/${file}`),
  }
}

/** 本地/银行渠道与 Apple/Google Pay 一样走 payUrl 跳转，文案共用这套说明 */
function redirectPayCopy(method: string) {
  return {
    desc: $t('您已选择{method}作为付款方式。', { method }),
    tip: $t('提交后将前往支付界面，请在规定的期限内完成付款。'),
  }
}

const selectedPayway = defineModel<PayWay>()

const emit = defineEmits<{
  /** 其它支付方式面板是否展开，父级据此显示分类下拉 */
  otherPayOpen: [open: boolean]
}>()

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
    ...themedPayIcon('payment_icon_balance.svg'),
  },
  {
    label: 'Card',
    value: [PayWay.Card],
    ...themedPayIcon('payment_icon_cards.svg'),
  },
  {
    label: $t('支付宝'),
    value: [PayWay.Alipay],
    ...themedPayIcon('payment_icon_alipay.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: $t('支付宝') }),
    tip: $t('提交后将前往支付界面，请在规定的期限内完成付款。'),
  },
  {
    label: 'Apple Pay',
    value: [PayWay.ApplePay],
    ...themedPayIcon('payment_icon_applepay.svg'),
    ...redirectPayCopy('Apple Pay'),
  },
  {
    label: 'Google Pay',
    value: [PayWay.GooglePay],
    ...themedPayIcon('payment_icon_googlepay.svg'),
    ...redirectPayCopy('Google Pay'),
  },
  // 本地/银行渠道与 Apple/Google Pay 一样走 payUrl 跳转，不走绑卡或稳定币选择
  {
    label: 'FPX',
    value: [PayWay.FpxMy],
    ...themedPayIcon('payment_icon_fpx.svg'),
    ...redirectPayCopy('FPX'),
  },
  {
    label: 'GCash',
    value: [PayWay.GcashPh],
    ...themedPayIcon('payment_icon_gcash.svg'),
    ...redirectPayCopy('GCash'),
  },
  {
    label: 'UPI',
    value: [PayWay.UpiIn],
    ...themedPayIcon('payment_icon_upi.svg'),
    ...redirectPayCopy('UPI'),
  },
  {
    label: 'EPS',
    value: [PayWay.EpsAt],
    ...themedPayIcon('payment_icon_eps.svg'),
    ...redirectPayCopy('EPS'),
  },
  {
    label: 'Przelewy24',
    value: [PayWay.P24Pl],
    ...themedPayIcon('payment_icon_przelewy24.svg'),
    ...redirectPayCopy('Przelewy24'),
  },
  {
    label: 'PayU PL',
    value: [PayWay.PayuPl],
    ...themedPayIcon('payment_icon_payu.svg'),
    ...redirectPayCopy('PayU PL'),
  },
  {
    label: 'Multibanco',
    value: [PayWay.MultibancoPt],
    ...themedPayIcon('payment_icon_multibanco.svg'),
    ...redirectPayCopy('Multibanco'),
  },
  {
    label: 'Bitcoin',
    value: [PayWay.Bitcoin],
    ...themedPayIcon('payment_icon_bitcoin.svg'),
    ...redirectPayCopy('Bitcoin'),
  },
  {
    label: 'GrabPay',
    value: [PayWay.GrabpayMy],
    ...themedPayIcon('payment_icon_grabpay.svg'),
    ...redirectPayCopy('GrabPay'),
  },
  {
    label: 'BLIK',
    value: [PayWay.BlikPl],
    ...themedPayIcon('payment_icon_blik.svg'),
    ...redirectPayCopy('BLIK'),
  },
  {
    label: 'Pix',
    value: [PayWay.PixBr],
    ...themedPayIcon('payment_icon_pix.svg'),
    ...redirectPayCopy('Pix'),
  },
  {
    label: "Touch 'n Go",
    value: [PayWay.TouchngoMy],
    ...themedPayIcon('payment_icon_touchngo.svg'),
    ...redirectPayCopy("Touch 'n Go"),
  },
  {
    label: 'DuitNow',
    value: [PayWay.DuitnowMy],
    ...themedPayIcon('payment_icon_duitnow.svg'),
    ...redirectPayCopy('DuitNow'),
  },
  {
    label: 'SBP',
    value: [PayWay.SbpRu],
    ...themedPayIcon('payment_icon_sbp.svg'),
    ...redirectPayCopy('SBP'),
  },
  {
    label: 'YooMoney',
    value: [PayWay.YoomoneyRu],
    ...themedPayIcon('payment_icon_yoomoney.svg'),
    ...redirectPayCopy('YooMoney'),
  },
  {
    label: 'SberPay',
    value: [PayWay.SberpayRu],
    ...themedPayIcon('payment_icon_sberpay.svg'),
    ...redirectPayCopy('SberPay'),
  },
  {
    label: 'PromptPay',
    value: [PayWay.PromptpayTh],
    ...themedPayIcon('payment_icon_promptpay.svg'),
    ...redirectPayCopy('PromptPay'),
  },
  {
    label: 'TrueMoney',
    value: [PayWay.TruemoneyTh],
    ...themedPayIcon('payment_icon_truemoney.svg'),
    ...redirectPayCopy('TrueMoney'),
  },
  {
    label: 'VietQR',
    value: [PayWay.VietqrVn],
    ...themedPayIcon('payment_icon_vietqr.svg'),
    ...redirectPayCopy('VietQR'),
  },
  {
    label: $t('微信支付'),
    value: [PayWay.Wechat],
    ...themedPayIcon('payment_icon_wepay.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: $t('微信支付') }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。'),
  },
  {
    label: 'USDT/USDC',
    value: [PayWay.USDT, PayWay.USDC],
    ...themedPayIcon('payment_icon_usdt_usdc.svg'),
    desc: $t('您已选择{method}作为付款方式。', { method: 'USDT/USDC' }),
    tip: $t('提交后将显示一个二维码，请在规定的期限内完成付款。'),
    getValue: () => {
      return cryptoCoins.value.find((item: any) => item.name === 'stablecoin')?.value?.value as PayWay
    },
  },
]

const confirmText = computed(() => addFundsAndPay ? $t('充值并支付') : $t('确认'))
const expandedMethods = ref(false)

const availableMethods = computed(() => {
  return methods.reduce((acc, { value: payway, discount, ...meta }) => {
    if (acc.some(item => item.value.includes(payway)))
      return acc

    const found = defaultMethods.find(item => item.value.includes(payway))

    acc.push({
      label: found?.label ?? '',
      value: found?.value ?? [],
      image: resolvePayImage(found),
      discount,
      ...meta,
      disabled: disabledMethods.includes(payway),
      getValue: found?.getValue,
    })

    return acc
  }, [] as AvailableMethods[])
})

/** 按当前下拉分类过滤；All 展示全部 isShow 渠道 */
const filteredMethods = computed(() => {
  if (!category || category === PAYWAY_ALL_CATEGORY)
    return availableMethods.value
  return availableMethods.value.filter(item => item.category === category)
})

const showMoreButton = computed(() => {
  return !expandedMethods.value && filteredMethods.value.length > COLLAPSED_SLOTS
})

const visibleMethods = computed(() => {
  if (!showMoreButton.value)
    return filteredMethods.value
  return filteredMethods.value.slice(0, COLLAPSED_ITEM_COUNT)
})

const chooseMethod = computed(() => {
  const method = defaultMethods.find(item => item.value.includes(selectedPayway.value!))
  if (!method)
    return method
  return { ...method, image: resolvePayImage(method) }
})

onBeforeMount(() => {
  getCardList().then((data) => {
    if (data?.length) {
      selectedPayway.value = PayWay.Card
    }
  })
  getCryptoCoins()
})

async function getCardList() {
  loading.value = true
  const data = await getUserCards(true)
  loading.value = false

  // 无绑卡时必须展开其它支付方式。这里不能调用 toggleOtherPay：删卡刷新时面板可能已打开，再 toggle 会把它关掉
  if (!data?.length) {
    showOtherPay()
  }
  cardList.value = data?.map(item => ({ ...item, cardIcon: cardTypeMap[item.brand as keyof typeof cardTypeMap] }))
  activeCard.value = data?.[0]
  return data
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

/** 展开当前分类下被折叠的支付方式 */
function expandCurrentCategory() {
  expandedMethods.value = true
}

/** 分类内没有当前选中渠道时，落到该分类第一个可用项 */
function syncPaywayToFiltered() {
  const list = filteredMethods.value
  if (!list.length)
    return
  if (list.some(item => item.value.includes(selectedPayway.value!)))
    return
  const next = list.find(item => !item.disabled) ?? list[0]
  handleClick(next)
}

watch(() => category, () => {
  expandedMethods.value = false
  syncPaywayToFiltered()
})

watch(openOther, (open) => {
  emit('otherPayOpen', open)
}, { immediate: true })

/** 展开其它支付方式（无绑卡或删光卡片后保持面板可见） */
function showOtherPay() {
  genStripe.value = true
  openOther.value = true
  activeCard.value = undefined
}

function toggleOtherPay() {
  if (openOther.value) {
    openOther.value = false
    activeCard.value = cardList.value?.[0]
    return
  }
  showOtherPay()
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
  if (data.cardId) {
    selectedPayway.value = PayWay.Card
  }

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
    <div v-show="openOther" class="w-full grid grid-cols-3 gap-3 select-none payway">
      <template v-for="item in visibleMethods" :key="item.label">
        <div class="payway-item" :class="{ active: item.value.includes(selectedPayway!), disabled: item.disabled }" @click="handleClick(item)">
          <component :is="item.disabled ? RxToolTip : 'div'" class="relative flex items-center gap-2 w-full min-w-0">
            <div v-if="item.discount" class="payway-item-discount">
              {{ item.discount }}
            </div>
            <!-- 设计稿为 24px 品牌标与文案横排，contain 避免宽字标被裁切 -->
            <div class="payway-item-icon">
              <img :src="item.image">
            </div>
            <div class="payway-item-label">
              {{ item.label }}
            </div>

            <template #content>
              <span class="text-white">{{ $t('该支付方式暂时无法使用') }}</span>
            </template>
          </component>
        </div>
      </template>
      <RxButton v-if="showMoreButton" class="w-full" outlined size="lg" :label="$t('更多支付方式')" @click="expandCurrentCategory" />
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
  &-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    width: 100%;
    height: 40px;
    padding: 4px 12px 4px 10px;
    border: 1px solid var(--colors-border-border-base, #afb7bb);
    background: var(--colors-background-bg-action);
    border-radius: 6px;
    cursor: pointer;
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: normal;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    &:not(.disabled).active {
      border: 2px solid var(--colors-border-border-brand, #11a3fd);
      background:
        linear-gradient(
          180deg,
          var(--pattern-pay-gradient-selected-start, #def3ff) 0%,
          var(--pattern-pay-gradient-selected-end, rgb(255 255 255 / 0%)) 100%
        ),
        var(--colors-background-bg-action);
      font-weight: 600;
    }

    [data-theme='dark'] &:not(.disabled).active {
      background: linear-gradient(
        180deg,
        var(--pattern-pay-gradient-selected-start, #013d65) 0%,
        var(--pattern-pay-gradient-selected-end, #293038) 100%
      );
    }

    &-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      overflow: hidden;

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    &-label {
      flex: 1 0 0;
      min-width: 0;
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
