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
  return Number.isNaN(date.getTime()) ? lastDeductTime : format(date, 'yyyy - MM - dd')
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

function tryOpenWalletModal() {
  if (route.query[REDIRECT_ACTION] !== 'open-wallet-modal') {
    return
  }

  onCharge()

  // 消费一次性动作参数，避免切 tab 重挂载或刷新时再次弹出
  const query = { ...route.query }
  delete query[REDIRECT_ACTION]
  router.replace({ query })
}

watch(
  () => route.query[REDIRECT_ACTION],
  () => {
    tryOpenWalletModal()
  },
  { immediate: true },
)

useEmitterEvent('updateAutoRenewList', getUserPayInfo)

</script>

<template>
  <!-- 钱包卡：蓝色自上而下渐隐，下半部分被付款卡片面板压住 -->
  <div class="px-3">
    <div class="relative h-120 flex flex-col gap-5 pa-6 rounded-t-3 overflow-hidden balance">
      <!-- 右上角装饰：设计稿中的同心圆角方框 -->
      <div class="deco deco--5" />
      <div class="deco deco--4" />
      <div class="deco deco--3" />
      <div class="deco deco--1" />
      <div class="deco deco--2" />

      <div class="relative flex flex-col gap-5">
        <div class="flex flex-col gap-3">
          <div class="text-[16px] font-600 leading-[17px] font-[Archivo] text-content">
            {{ $t('钱包余额') }}
          </div>
          <div class="flex items-baseline gap-1 color-white font-600 min-w-0">
            <span class="text-[24px] leading-[29px]">$</span>
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-[32px] leading-[39px] truncate">{{ currency(userPayInfo.balance, { symbol: '' }).format() }}</span>
              <SvgIcon class="refresh-icon" :class="{
                         'refresh-icon--spinning': props.balanceRefreshUi === 'loading',
                         'cursor-pointer': props.balanceRefreshUi === 'idle',
                       }" :name="props.balanceRefreshUi === 'success' ? 'base/rx_ic_check' : 'base/rx_ic_refresh'" size="16"
                       :color="props.balanceRefreshUi === 'success' ? 'var(--colors-icon-icon-success)' : '#fff'" @click="props.balanceRefreshUi === 'idle' && $emit('refresh')"
              />
            </div>
          </div>
        </div>
        <button class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-1.5 cursor-pointer text-3.5 leading-5 font-500 topup-btn" @click="onCharge">
          <SvgIcon name="base/rx_ic_plus" size="16" color="currentColor" />
          {{ $t('充值') }}
        </button>
      </div>

      <div class="relative h-0 border-t border-t-dashed border-white/60" />

      <div class="relative flex flex-col gap-3 text-content">
        <div class="flex gap-5">
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <div class="text-3 leading-4 tracking-[-0.12px] opacity-80 truncate">
              {{ $t('下次扣费') }}
            </div>
            <div class="text-3.5 leading-5 font-600 tracking-[-0.14px]">
              {{ nextBillingDateText }}
            </div>
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <div class="text-3 leading-4 tracking-[-0.12px] opacity-80 truncate">
              {{ $t('扣除金额') }}
            </div>
            <div class="text-3.5 leading-5 font-600 tracking-[-0.14px]">
              {{ deductionAmountText }}
            </div>
          </div>
        </div>
        <i18n-t class="text-3 leading-4 referral" tag="div" :keypath="$t('参与 {invite} 获得奖励', { invite: '{invite}' })" scope="global">
          <template #invite>
            <span class="cursor-pointer font-500 underline underline-offset-2 opacity-100" @click="router.push({ name: 'referral-program' })">{{ $t('推广计划') }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.balance {
  background: linear-gradient(180deg, #11a3fd 20%, rgba(17, 163, 253, 0) 100%);
}

.text-content {
  color: var(--component-dropdown-text-active, #fff);
}

.topup-btn {
  color: var(--colors-text-text-brand, #11a3fd);
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  transition: background 0.15s;

  &:hover {
    background: #f5fbff;
  }
}

.referral {
  color: rgba(255, 255, 255, 0.8);

  span {
    color: #fff;
  }
}

// 装饰方框：坐标取自设计稿（相对卡片左上角，卡宽 356）
.deco {
  position: absolute;
  border: 1.25px solid #fff;
  pointer-events: none;

  &--1 {
    left: 291px;
    top: -107px;
    width: 150px;
    height: 150px;
    border-radius: 15px;
    opacity: 0.4;
  }
  &--2 {
    left: 304.75px;
    top: -93.25px;
    width: 122.5px;
    height: 122.5px;
    border-radius: 7.5px;
    opacity: 0.5;
  }
  &--3 {
    left: 276px;
    top: -122px;
    width: 180px;
    height: 180px;
    border-radius: 22.5px;
    opacity: 0.3;
  }
  &--4 {
    left: 261px;
    top: -137px;
    width: 210px;
    height: 210px;
    border-radius: 33.75px;
    opacity: 0.2;
  }
  &--5 {
    left: 246px;
    top: -152px;
    width: 240px;
    height: 240px;
    border-radius: 43.75px;
    opacity: 0.1;
  }
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
