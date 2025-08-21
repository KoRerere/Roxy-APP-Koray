<script setup lang="tsx">
import StripePay from '/@/views/pay/wallet/components/stripe-pay.vue';
import Checkbox from 'primevue/checkbox';
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user';
import { $t } from '/@/locales';
import { RxSvgIcon } from '/@/components/rx-icon';
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';
import { AutoRechargeStatus } from '/@/enums/pay';
import { useConfirm } from 'primevue/useconfirm';
import { usePopupMenu } from '/@/hooks/usePopupMenu';

const confirm = useConfirm();
const { userCards, userPayInfo } = storeToRefs(useUserStore())
const { getUserCards, getUserPayInfo } = useUserStore()
const { showMenu } = usePopupMenu()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()

const bindCss = useCssModule('bind')
const cardDefault = ref(false)
const autoRecharge = ref(userPayInfo.value.autoRecharge.toString())
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

watch(() => userPayInfo.value.autoRecharge, value => {
  autoRecharge.value = value.toString()
})

onBeforeMount(() => {
  getUserCards()
})

function matchCard(type: string): any {
  return cardTypeMap[type as keyof typeof cardTypeMap]
}

async function checkAutoRecharge() {
  if (AutoRechargeStatus.Open === userPayInfo.value.autoRecharge) {
    confirm.require({
      header: $t('关闭组合支付'),
      message: $t('关闭后，当剩余钱包余额不足以自动续订时，相关服务将会中断。'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('确认'),
        severity: 'danger',
      },
      accept: () => {
        enableAutoRecharge()
      },
      reject: () => {
        autoRecharge.value = userPayInfo.value.autoRecharge.toString()
      },
      onHide: () => {
        autoRecharge.value = userPayInfo.value.autoRecharge.toString()
      }
    })
    return
  }

  if (!userCards.value?.length) {
    bindCard(true)
      .then(enableAutoRecharge)
      .catch(() => {
        autoRecharge.value = userPayInfo.value.autoRecharge.toString()
      })
    return
  }

  enableAutoRecharge()
}

async function enableAutoRecharge() {
  const { code, msg } = await API.pay.userSetAutoRechargeStatusCreate({ status: Number(autoRecharge.value) })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    autoRecharge.value = userPayInfo.value.autoRecharge.toString()
    return
  }
  getUserPayInfo()
}

function bindCard(defaultCard: boolean = false) {
  const { promise, resolve, reject } = Promise.withResolvers<boolean>()

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <div class="w-120 flex flex-col gap-4 pa-6 pt-4">
        <div class="h-9 flex justify-between items-center">
          <div>{$t('新增卡片')}</div>
          <div class="cursor-pointer" onClick={
            () => {
              hideModal()
              reject(false)
            }
          }>
            <RxSvgIcon size="20" name="base/rx_ic_delete" ></RxSvgIcon>
          </div>
        </div>
        <StripePay class="w-full !min-w-auto"
          bind={true}
          onConfirm={async (card) => {
            const { code, msg } = await API.pay.userBindCardCreate({ paymentMethodId: card.payment_method, cardDefault: defaultCard || cardDefault.value })
            onlyErrorToast(code, msg)
            hideModal()
            if (code !== 0) {
              reject(false)
              return
            }
            getUserCards(true)
            resolve(true)
          }}
        >{{
          after: () => {
            return !defaultCard && <div class="flex items-center gap-2.5">
              <Checkbox v-model={cardDefault.value} input-id="wrap" binary />
              <label for="wrap" class={`select-none ${bindCss.default}`}>{$t('设置为默认卡片')}</label>
            </div>
          }
        }}</StripePay>
      </div>,
    }
  })

  return promise
}

function onMenuCommand(event: MouseEvent, card: any) {
  showMenu(event, {
    model: [
      {
        label: $t('设置为默认卡片'),
        icon: 'base/rx_ic_credit_card',
        disabled: !!card.cardDefault,
        command: () => {
          setMainCard(card.cardId)
        },
      },
      {
        separator: true,
      },
      {
        label: $t('删除'),
        icon: 'base/rx_ic_bin_1',
        command: () => {
          deleteCard(card.cardId)
        },
      }
    ]
  })
}

async function setMainCard(cardId: number) {
  const { code, msg } = await API.pay.userSetMainCardCreate({ cardId })
  showToast(code, msg)
  if (code !== 0) return
  getUserCards(true)
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
      getUserCards(true)
    }
  })
}
</script>

<template>
  <div class="flex flex-col gap-6 select-none">
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center">
        <div class="title">
          {{ $t('启用自动续订组合支付') }}
        </div>
        <RxToggleSwitch v-model="autoRecharge" @change="checkAutoRecharge" trueValue="1" falseValue="0" />
      </div>
      <div class="desc">
        {{ $t('当钱包余额不足以自动续订时，自动用卡片组合支付。') }}
      </div>
      <div class="desc">
        {{ $t('（仅默认卡片会被用于组合支付）') }}
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center">
        <div class="title">{{ $t('卡片信息') }}</div>
        <div class="add cursor-pointer" :class="{ 'p-disabled !cursor-not-allowed': userCards && userCards.length >= 4 }" @click="bindCard()">+ {{ $t('新增') }}</div>
      </div>
      <div class="desc" v-if="!userCards?.length">{{ $t('暂无绑定卡片') }}</div>
      <template v-if="!!userCards?.length">
        <div class="h-10 flex justify-between items-center" v-for="card in userCards" :key="card.cardId">
          <div class="flex items-center gap-2.5">
            <SvgIcon :name="matchCard(card.brand!)" size="32"></SvgIcon>
            <span class="card-number">{{ `**** **** **** ${card.last4}` }}</span>
            <span v-if="card.cardDefault" class="card-default">DEFAULT</span>
          </div>
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_more-v" @click="onMenuCommand($event, card)" />
        </div>
      </template>
    </div>
  </div>
</template>

<style module="bind">
.default {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
}
</style>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
}

.add {
  color: var(--colors-text-text-brand);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
}

.card {
  &-number {
    color: var(--colors-text-text-tertiary);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: 20px;
  }

  &-default {
    display: flex;
    padding: 2px 4px;
    justify-content: center;
    align-items: center;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);

    color: var(--component-tag-text);
    font-family: "JetBrains Mono";
    font-size: 10px;
    font-weight: 800;
    line-height: normal;
  }
}
</style>
