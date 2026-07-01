<script setup lang="ts">
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import WalletPaymentMethods from '/@/views/pay/wallet/components/wallet-payment-methods.vue'
import NextBouns from '/@/views/campaign/june-eighteen/next-bouns.vue'
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { debounce } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { useCampaignStore } from '/@/stores/campaign'
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
const { getActivityTotalRecharge } = useCampaignStore()

const paywayList = [PayWay.Wechat, PayWay.Alipay, PayWay.Card, PayWay.USDT, PayWay.USDC].map(item => ({ value: item }))
const selectedPayway = ref(paywayList[0].value)

const disabledMethods = ref<PayWay[]>([])
const min = 10
const max = 10 ** 5
const step = 10
const amount = ref(10)
const loading = ref(false)
const lockModal = ref(false)
const minRechargeAmount = 1
const playInfoList = ref()

const rechargeAmount = computed(() => needAmount ? Math.max(needAmount, minRechargeAmount) : (amount.value ?? min))
const lockMessage = computed(() => lockModal.value ? $t('正在处理支付，请勿关闭。') : '')

const playInfo = computed(() => {
  if (!playInfoList.value)
    return {}

  const data = playInfoList.value.find((item: any) => item.payType === selectedPayway.value)

  return {
    ...data,
    activityTotalRecharge: getActivityTotalRecharge(rechargeAmount.value),
  }
})

provide('$rechargeModal', {
  preventModalClose: (value = true) => {
    lockModal.value = value
  },
})

onBeforeMount(() => {
  if (needAmount) {
    mixpanelTrack('click_enter_wallet_recharge_insufficient')
  }
  else {
    mixpanelTrack('wallet_recharge_click')
  }
  querySupportPayway()
})

const delayQuery = debounce(querySupportPayway, 300)

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetPayChannelFeesList({ amount: String(rechargeAmount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  const payway = data.filter(item => item.isShow).map(item => item.payType) as PayWay[]
  disabledMethods.value = Object.values(PayWay).filter(item => !payway.includes(item))
  playInfoList.value = data

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
      <div v-if="needAmount" class="flex flex-col gap-4">
        <div v-if="playInfo.feeRate > 0" class="flex flex-col gap-2 w-full">
          <div class="flex justify-between items-center">
            <div class="text-3.5 text-[var(--colors-text-text-tertiary)] font-500">
              {{ $t('充值金额') }}
            </div>
            <div class="text-[var(--colors-text-text-secondary)]">
              {{ currency(rechargeAmount).format() }}
            </div>
          </div>

          <div class="flex justify-between items-center">
            <div class="flex gap-1 items-center text-3.5 text-[var(--colors-text-text-tertiary)] font-500">
              <div>{{ $t('收取 {feeRate}% 的手续', { feeRate: playInfo.feeRate }) }}</div>
              <div v-tooltip.top="{ value: $t('由于银行处理成本，该支付渠道需加收 {feeRate}% 的手续费。', { feeRate: playInfo.feeRate }) }" class="flex items-center">
                <SvgIcon name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
              </div>
            </div>
            <div class="text-[var(--colors-text-text-secondary)]">
              {{ currency(playInfo.fee).format() }}
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center need">
          <div class="need-label">
            {{ $t('实付金额') }}
          </div>
          <div class="need-value">
            {{ currency(playInfo.total).format() }}
          </div>
        </div>
        <RxAlert v-if="needAmount < minRechargeAmount" class="w-full" type="info" :content="$t('根据支付平台的要求，最低充值金额为 {amount}。', { amount: currency(minRechargeAmount).format() })" />
      </div>
      <ItemBlock v-else :title="$t('请输入充值金额')">
        <div class="flex flex-col items-center gap-4">
          <RxStepInput v-model="amount" class="!w-60 !h-18" size="lg" :min="min" :max="max" :step="step" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="0"
                       :pt="{ pcinputtext: { root: '!text-8 !font-bold' } }" @update:model-value="onUpdate" @change="delayQuery"
          />
          <div class="px-6 justify-between flex gap-3 tt-tertiary">
            <I18nT class="font-500 text-3.5" scope="global" tag="div" :keypath="$t('实付金额：{money}', { money: '{money}' })">
              <template #money>
                <span class="tt-brand font-600">{{ currency(playInfo.total).format() }}</span>
                <span v-if="playInfo.activityTotalRecharge > rechargeAmount" class="tt-brand font-600">({{ $t('到账 {amount}', { amount: currency(playInfo.activityTotalRecharge).format() }) }})</span>
              </template>
            </I18nT>
            <div v-if="playInfo.feeRate > 0" class="flex gap-1 items-center text-3.5">
              <div>{{ $t('收取 {feeRate}% 的手续: {fee}', { feeRate: playInfo.feeRate, fee: currency(playInfo.fee).format() }) }}</div>
              <div v-tooltip.top="{ value: $t('由于银行处理成本，该支付渠道需加收 {feeRate}% 的手续费。', { feeRate: playInfo.feeRate }) }" class="flex items-center">
                <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
              </div>
            </div>
          </div>
          <div class="mt-1 flex flex-col gap-2.5">
            <RxAmountQuickCheck @select="quickSelect" />
            <NextBouns :amount="rechargeAmount" />
          </div>
        </div>
      </ItemBlock>
    </div>

    <div class="flex-1 flex-col px-6 pb-6 gap-6 overflow-y-auto">
      <ItemBlock :title="$t('选择支付方式')">
        <WalletPaymentMethods v-model="selectedPayway" :add-funds-and-pay="!!needAmount" :recharge-amount="rechargeAmount" :methods="paywayList" :disabled-methods="disabledMethods"
                              :on-confirm="confirm" :play-info="playInfo"
        />
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
