<script setup lang="ts">
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import WalletPaymentMethods from '/@/views/pay/wallet/components/wallet-payment-methods.vue'
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { debounce } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { PayWay } from '/@/enums/pay'
import { ceilByStep } from '/@/views/pay/subscribe/util'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'

interface Props {
  needAmount?: number
  onConfirm?: (params: { payType: PayWay, rechargeAmount: number, [key: string]: any }) => any | Promise<any>
  onCancel?: () => any | Promise<any>
}

const { needAmount, onConfirm, onCancel } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const [_, onlyErrorToast] = useResponseToast()
const { mixpanelTrack } = useUserStore()

const selectedPayway = ref(PayWay.Card)
const paywayList = [PayWay.Card, PayWay.Alipay, PayWay.Wechat, PayWay.USDT, PayWay.USDC].map(item => ({ value: item }))

const disabledMethods = ref<PayWay[]>([])
const min = 10
const max = 10 ** 5
const step = 10
const amount = ref(10)
const loading = ref(false)
const lockModal = ref(false)
const minRechargeAmount = 1

const rechargeAmount = computed(() => needAmount ? Math.max(needAmount, minRechargeAmount) : (amount.value ?? min))
const lockMessage = computed(() => lockModal.value ? $t('正在处理支付，请勿关闭。') : '')

onBeforeMount(() => {
  if (needAmount) {
    querySupportPayway()
    mixpanelTrack('click_enter_wallet_recharge_insufficient')
  }
  else {
    mixpanelTrack('wallet_recharge_click')
  }
})

provide('$rechargeModal', {
  preventModalClose: (value = true) => {
    lockModal.value = value
  },
})

const delayQuery = debounce(querySupportPayway, 300)

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetSupportPayTypeList({ amount: String(rechargeAmount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  const payway = Object.values(data).flat() as PayWay[]
  disabledMethods.value = Object.values(PayWay).filter(item => !payway.includes(item))

  if (!payway.includes(selectedPayway.value)) {
    selectedPayway.value = payway[0]!
  }
}

function onUpdate(value: number) {
  nextTick(() => {
    amount.value = Math.min(Math.max(ceilByStep(currency(value).value, step), min), max)
    delayQuery()
  })
}

function quickSelect(value: number) {
  amount.value = value
  delayQuery()
}

async function confirm(extraData: any) {
  await onConfirm?.({
    payType: selectedPayway.value,
    rechargeAmount: rechargeAmount.value,
    ...extraData,
  })

  if (needAmount) {
    mixpanelTrack('click_confirm_recharge_insufficient')
  }
  else {
    mixpanelTrack('click_confirm_recharge')
  }

  lockModal.value = false
  close(false)
}

function close(isCancel: boolean) {
  if (lockModal.value)
    return
  emit('close')
  if (isCancel)
    onCancel?.()
}
</script>

<template>
  <div class="flex flex-col pt-4 gap-6 overflow-hidden popup">
    <div class="h-10 relative flex justify-between items-center px-6 header">
      <span>{{ $t('钱包充值') }}</span>
      <SvgIcon v-tooltip.top="lockMessage" :class="[lockModal ? 'cursor-not-allowed' : 'cursor-pointer']" size="24" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)"
               @click="close(true)"
      />
    </div>
    <div class="flex flex-col gap-6 px-6">
      <div v-if="needAmount">
        <div class="h-11 flex justify-between items-center need">
          <div class="need-label">
            {{ $t('应充值金额') }}
          </div>
          <div class="need-value">
            {{ currency(rechargeAmount).format() }}
          </div>
        </div>
        <RxAlert v-if="needAmount < minRechargeAmount" class="w-full" type="info" :content="$t('根据支付平台的要求，最低充值金额为 {amount}。', { amount: currency(minRechargeAmount).format() })" />
      </div>
      <ItemBlock v-else :title="$t('请输入充值金额')">
        <div class="flex flex-col items-center gap-4">
          <RxStepInput v-model="amount" class="!w-60 !h-18" size="lg" :min="min" :max="max" :step="step" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="0"
                       :pt="{ pcinputtext: { root: '!text-8 !font-bold' } }" @update:model-value="onUpdate" @change="delayQuery"
          />
          <div class="flex gap-2">
            <RxAmountQuickCheck @select="quickSelect" />
          </div>
        </div>
      </ItemBlock>
    </div>
    <div class="flex-1 flex-col px-6 pb-6 gap-6 overflow-y-auto">
      <ItemBlock :title="$t('选择支付方式')">
        <WalletPaymentMethods v-model="selectedPayway" :recharge-amount="rechargeAmount" :methods="paywayList" :disabled-methods="disabledMethods" :on-confirm="confirm" />
      </ItemBlock>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
}

.header {
  color: var(--colors-text-text-primary);
  font-family: 'Microsoft YaHei UI';
  font-size: 20px;
  font-weight: 700;
  line-height: normal;
}

.need {
  &-label {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }

  &-value {
    color: var(--color-blue-300, #12a3fc);
    font-size: 20px;
    font-weight: 600;
    line-height: normal;
  }
}
</style>
