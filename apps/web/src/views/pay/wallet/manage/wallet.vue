<script setup lang="ts">
import currency from 'currency.js'
import { format, parse } from 'date-fns'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useUserStore } from '/@/stores/user'
import { OrderType } from '/@/enums/pay'
import { emitter, useEmitterEvent } from '/@/utils/eventBus'
import { REDIRECT_ACTION } from '/@/constants/search-params-key'

const props = withDefaults(
  defineProps<{
    balanceRefreshUi?: 'idle' | 'loading' | 'success'
  }>(),
  { balanceRefreshUi: 'idle' },
)

defineEmits(['refresh'])

const router = useRouter()
const route = useRoute()
const redirectAction = route.query[REDIRECT_ACTION] as string
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()

/** 下次扣费日期；接口无记录时 lastDeductTime 为空串 */
const nextBillingDateText = computed(() => {
  const lastDeductTime = userPayInfo.value.lastDeductTime
  if (!lastDeductTime) {
    return $t('暂无')
  }
  // 后端固定 YYYY-MM-DD HH:mm:ss，避免 new Date 对空格分隔格式解析不一致
  const date = parse(lastDeductTime, 'yyyy-MM-dd HH:mm:ss', new Date())
  return Number.isNaN(date.getTime()) ? lastDeductTime : format(date, 'yyyy / MM / dd')
})

/** 扣除金额；接口无记录时 lastDeductAmount 为 0 */
const deductionAmountText = computed(() => {
  const lastDeductAmount = userPayInfo.value.lastDeductAmount
  if (!lastDeductAmount) {
    return $t('暂无')
  }
  return currency(lastDeductAmount).format()
})

function onCharge() {
  walletRecharge({
    next: (data) => {
      openProcessing(data, OrderType.Recharge)
        .finally(() => {
          emitter.emit('updateBillList')
          getUserPayInfo()
        })
    },
  })
}

onMounted(() => {
  if (redirectAction === 'open-wallet-modal') {
    onCharge()
  }
})

useEmitterEvent('updateAutoRenewList', getUserPayInfo)
</script>

<template>
  <div class="relative flex flex-col pa-5 gap-4 h-full overflow-hidden balance">
    <div class="relative z-1 flex flex-row justify-between items-center gap-4">
      <div class="text-4.5 font-600 leading-normal color-white/80 font-[Archivo]">
        {{ $t('钱包余额') }}
      </div>
      <i18n-t class="text-3 leading-4 color-white/80" tag="div" :keypath="$t('参与 {invite} 获得奖励', { invite: '{invite}' })" scope="global">
        <template #invite>
          <span class="cursor-pointer color-white link" @click="router.push({ name: 'referral-program' })">{{
            $t('推广计划') }}
          </span>
        </template>
      </i18n-t>
    </div>

    <div class="relative z-1 flex items-center justify-between gap-4 pt-1 pb-3">
      <div class="flex items-center gap-3">
        <div class="flex items-baseline gap-0.5 color-white text-8 font-600 leading-normal">
          <span>$</span>
          <span class="text-10">{{ currency(userPayInfo.balance, { symbol: '' }).format() }}</span>
        </div>
        <SvgIcon class="refresh-icon" :class="{
                   'refresh-icon--spinning': props.balanceRefreshUi === 'loading',
                   'cursor-pointer': props.balanceRefreshUi === 'idle',
                 }" :name="props.balanceRefreshUi === 'success' ? 'base/rx_ic_check' : 'base/rx_ic_refresh'" size="20"
                 :color="props.balanceRefreshUi === 'success' ? 'var(--colors-icon-icon-success)' : '#fff'" @click="props.balanceRefreshUi === 'idle' && $emit('refresh')"
        />
      </div>
      <RxButton class="shrink-0" severity="secondary" variant="outlined" size="lg" :label="$t('充值')" @click="onCharge" />
    </div>

    <RxDivider class="opacity-50" line-only line-style="dashed" line-color="#ffffff" />

    <div class="relative z-1 flex gap-5">
      <div class="flex-1 flex flex-col gap-1">
        <div class="text-3.25 leading-4.5 color-white/80">
          {{ $t('下次扣费') }}
        </div>
        <div class="text-4 font-600 leading-6 color-white">
          {{ nextBillingDateText }}
        </div>
      </div>
      <RxDivider class="opacity-50" line-only line-style="dashed" line-color="#ffffff" vertical />
      <div class="flex-1 flex flex-col gap-1">
        <div class="text-3.25 leading-4.5 color-white/80">
          {{ $t('扣除金额') }}
        </div>
        <div class="text-4 font-600 leading-6 color-white">
          {{ deductionAmountText }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.balance {
  border-radius: 12px;
  background:
    linear-gradient(122deg, #11a3fd 50.11%, #92d6ff 109.67%), linear-gradient(180deg, #66c4fd 0%, #11a3fd 100%),
    linear-gradient(
      180deg,
      var(--pattern-pay-wallet-bg-start, #fff) -0.2%,
      var(--pattern-pay-wallet-bg-end, #e0f1fe) 185.89%
    );

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: url('/images/payments/ripple_white.svg') no-repeat right top / 299px 166px;
  }
}

.link {
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}

.refresh-icon {
  display: inline-flex;
  flex-shrink: 0;
  transform-origin: 50% 50%;

  &--spinning {
    animation: refresh-spin 0.75s linear infinite;
  }
}

@keyframes refresh-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
