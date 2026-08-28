<script setup lang="ts">
import ItemBlock from '/@/views/pay/subscribe/components/item-block.vue'
import WalletPaymentMethods from '/@/views/pay/wallet/components/wallet-payment-methods.vue'
import PaywayCategorySelect from '/@/views/pay/wallet/components/payway-category-select.vue'
import { PAYWAY_ALL_CATEGORY } from '/@/views/pay/wallet/components/payway-category'
import NextBouns from '/@/views/campaign/new-user/next-bouns.vue'
import currency from 'currency.js'
import { debounce } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { useCampaignStore } from '/@/stores/campaign'
import { PayWay } from '/@/enums/pay'
import { ceilByStep } from '/@/views/pay/subscribe/util'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'
import type { UserGetPayChannelFeesListData } from '@roxy/backend-api'

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
const { walletRechargeMinAmount } = storeToRefs(useUserStore())
const { mixpanelTrack, getUserPayInfo } = useUserStore()
const { getActivityTotalRecharge } = useCampaignStore()

type PayChannelFee = UserGetPayChannelFeesListData['data'][number]

const selectedPayway = ref<PayWay>(PayWay.Wechat)
const selectedCategory = ref(PAYWAY_ALL_CATEGORY)
/** 有绑卡时默认只看卡片，展开「其它支付方式」后才显示分类下拉 */
const otherPayOpen = ref(false)
const DEFAULT_MAX = 10 ** 5
const loading = ref(false)
const lockModal = ref(false)
const playInfoList = ref<PayChannelFee[]>()

/** 仅展示接口 isShow 的渠道，并带上 category 供筛选 */
const paywayList = computed(() => {
  return (playInfoList.value ?? [])
    .filter(item => item.isShow)
    .map(item => ({ value: item.payType as PayWay, category: item.category }))
})

/** 下拉选项按接口出现顺序去重 */
const payCategories = computed(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const item of paywayList.value) {
    if (!item.category || seen.has(item.category))
      continue
    seen.add(item.category)
    list.push(item.category)
  }
  return list
})

/** 首充用 5 美金步长才能选到 5；已充值用户仍按 10 美金步进 */
const defaultStep = computed(() => walletRechargeMinAmount.value)

/** 余额不足时最低充值不得低于缺口金额（按 step 向上取整） */
const min = computed(() => {
  if (!needAmount)
    return walletRechargeMinAmount.value
  return Math.max(ceilByStep(currency(needAmount).value, defaultStep.value), walletRechargeMinAmount.value)
})

const amount = ref(min.value)
const rechargeAmount = computed(() => amount.value ?? min.value)
const lockMessage = computed(() => lockModal.value ? $t('正在处理支付，请勿关闭。') : '')

/** 括号内只拼实际存在的费率项，避免出现 0%+$0.00 */
function formatFeeDetail(feeRate: number, feeFixed: number) {
  const parts: string[] = []
  if (feeRate > 0)
    parts.push(`${feeRate}%`)
  if (feeFixed > 0)
    parts.push(currency(feeFixed).format())
  return parts.join('+')
}

const playInfo = computed(() => {
  const data = playInfoList.value?.find(item => item.payType === selectedPayway.value)
  const fee = data?.fee ?? 0
  const feeRate = data?.feeRate ?? 0
  const feeFixed = data?.feeFixed ?? 0

  return {
    total: data?.total ?? 0,
    fee,
    feeDetail: formatFeeDetail(feeRate, feeFixed),
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
  // 刷新 isFirstRecharge，避免沿用过期的最低充值门槛
  void getUserPayInfo()
  querySupportPayway()
})

watch([min, walletRechargeMinAmount], ([nextMin], [, prevWalletMin]) => {
  // 付费信息到达后：金额低于新门槛则抬升；仍停在旧下限则对齐到新的默认值（如 10→5）
  if (amount.value < nextMin || amount.value === prevWalletMin)
    amount.value = nextMin
})

watch(otherPayOpen, (open) => {
  // 收起其它支付方式后回到 All，避免下次展开仍停在旧分类
  if (!open)
    selectedCategory.value = PAYWAY_ALL_CATEGORY
})

const delayQuery = debounce(querySupportPayway, 300)

async function querySupportPayway() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetPayChannelFeesList({ amount: String(rechargeAmount.value) })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  playInfoList.value = data
  const payway = data.filter(item => item.isShow).map(item => item.payType) as PayWay[]

  if (payway.length && !payway.includes(selectedPayway.value)) {
    selectedPayway.value = payway[0]!
  }
}

function onUpdate(value: number) {
  nextTick(() => {
    amount.value = Math.min(Math.max(ceilByStep(currency(value).value, defaultStep.value), min.value), DEFAULT_MAX)
    delayQuery()
  })
}

function quickSelect(value: number) {
  amount.value = Math.min(Math.max(value, min.value), DEFAULT_MAX)
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
  <div class="flex flex-col pt-4 gap-6 overflow-hidden w-140">
    <div class="h-10 relative flex justify-between items-center px-6">
      <span class="tt-primary text-5 font-700 leading-normal">{{ $t('钱包充值') }}</span>
      <SvgIcon v-tooltip.top="lockMessage" :class="[lockModal ? 'cursor-not-allowed' : 'cursor-pointer']" size="24" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)"
               @click="close(true)"
      />
    </div>

    <div v-if="needAmount" class="px-6 flex justify-between items-center need">
      <div class="tt-primary text-3.5 leading-5">
        {{ $t('至少还需充值') }}
      </div>
      <div class="tt-brand text-5 font-600 leading-normal">
        {{ currency(needAmount).format() }}
      </div>
    </div>

    <div class="flex flex-col gap-6 px-6">
      <ItemBlock :title="$t('请输入充值金额')">
        <div class="flex flex-col items-center gap-4">
          <RxStepInput v-model="amount" class="!w-60 !h-18" size="lg" :min="min" :max="DEFAULT_MAX" :step="defaultStep" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="0"
                       :pt="{ pcinputtext: { root: '!text-8 !font-bold' } }" @update:model-value="onUpdate" @change="delayQuery"
          />
          <div class="px-6 justify-between flex gap-3 tt-tertiary">
            <I18nT class="font-500 text-3.5" scope="global" tag="div" :keypath="$t('实付金额：{money}', { money: '{money}' })">
              <template #money>
                <span class="tt-brand font-600">{{ currency(playInfo.total).format() }}</span>
                <span v-if="playInfo.activityTotalRecharge > rechargeAmount" class="tt-brand font-600">({{ $t('到账 {amount}', { amount: currency(playInfo.activityTotalRecharge).format() }) }})</span>
              </template>
            </I18nT>
            <div v-if="playInfo.fee > 0" class="flex gap-1 items-center text-3.5">
              <div>{{ $t('手续费（{feeDetail}）：{fee}', { feeDetail: playInfo.feeDetail, fee: currency(playInfo.fee).format() }) }}</div>
              <div v-if="selectedPayway === PayWay.Card" v-tooltip.top="{ value: $t('由于银行处理成本，该支付渠道需加收 {feeDetail} 的手续费。', { feeDetail: playInfo.feeDetail }) }" class="flex items-center">
                <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
              </div>
            </div>
          </div>
          <div class="mt-1 flex flex-col gap-2.5">
            <RxAmountQuickCheck :min="min" @select="quickSelect" />
          </div>
        </div>
      </ItemBlock>
    </div>
    <div class="flex-1 flex-col px-6 pb-6 gap-6 overflow-y-auto">
      <ItemBlock :title="$t('选择支付方式')">
        <template v-if="otherPayOpen" #extra>
          <PaywayCategorySelect v-model="selectedCategory" :categories="payCategories" />
        </template>
        <WalletPaymentMethods v-model="selectedPayway" :category="selectedCategory" :add-funds-and-pay="!!needAmount" :recharge-amount="rechargeAmount" :methods="paywayList"
                              :on-confirm="confirm" @other-pay-open="otherPayOpen = $event"
        />
      </ItemBlock>
    </div>
  </div>
</template>
