<script setup lang="tsx">
import currency from 'currency.js'
import { RxAlert } from '/@/components/rx-alert'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { PAY_PROCESSING_BACK, usePay } from '/@/views/pay/wallet/hook.tsx'
import { PayWay } from '/@/enums/pay'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { formatDiscountOff, getImage } from '/@/utils/basic'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'

interface Props {
  amount: number
  originalAmount?: number
  discountAmount?: number
  showAutoRenew?: boolean
  /** 取消支付时是否跳转到钱包账单页，默认 true */
  cancelRedirect?: boolean
  onConfirm?: (params: { payType: PayWay, isAuto: boolean }) => any | Promise<any>
  onCancel?: () => any | Promise<any>
}

const { amount, originalAmount, discountAmount, showAutoRenew = false, cancelRedirect = true, onConfirm, onCancel } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const { setActivityModalOpenStatus } = useFreedomActivity()
const [showToast] = useResponseToast()

const loading = ref(false)
const isAuto = ref(showAutoRenew ? !!userPayInfo.value.isAuto : false)
const { beforeToggleAutoRenew } = useConfirmAutoRenew()

const imgSrc = computed(() => {
  return isDarkTheme.value ? getImage('payments/dark/wallet.svg') : getImage('payments/light/wallet.svg')
})

const finalResult = computed(() => {
  // 自动续费折扣自下一期账单起生效，本次付款不参与折抵，金额只取上游传入的结算价
  // 跟后台保持一致，2 位小数四舍五入
  const _amount = currency(amount).value
  const _discountAmount = currency(discountAmount ?? 0).value
  const needAmount = currency(_amount).subtract(userPayInfo.value.balance).value

  return {
    originalAmount,
    amount: _amount,
    discountAmount: _discountAmount,
    showDiscount: originalAmount && _discountAmount,
    needRecharge: needAmount > 0,
    needAmount,
  }
})

onBeforeMount(() => {
  getUserPayInfo()
})

function onRecharge() {
  walletRecharge({
    needAmount: finalResult.value.needAmount,
    next: (data) => {
      setActivityModalOpenStatus()
      // 不 await：与「服务和钱包」一致，先关掉充值弹窗再出扫码，避免两个弹窗叠层
      openProcessing(data, 'silent', { cancelRedirect })
        .then(confirm)
        .catch((error) => {
          if (error === PAY_PROCESSING_BACK) {
            return
          }
          showToast(1, $t('支付失败'))
          close(false)
        })
    },
  })
}

async function confirm() {
  await onConfirm?.({
    payType: PayWay.Balance,
    isAuto: isAuto.value,
  })
  close(false)
}

function close(isCancel: boolean) {
  emit('close')
  if (isCancel) {
    onCancel?.()
  }
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="relative flex justify-between items-center h-10 header">
      <span>{{ $t('通过钱包进行支付') }}</span>
      <SvgIcon class="cursor-pointer" size="24" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)" @click="close(true)" />
    </div>

    <div class="flex flex-col gap-5">
      <div class="flex flex-col items-center gap-4 py-8">
        <div class="order-title">
          {{ $t('总价') }}
        </div>
        <div class="flex flex-col gap-1">
          <div class="order-price">
            {{ currency(finalResult.amount).format() }}
          </div>
          <div v-if="finalResult.showDiscount" class="flex justify-center items-baseline gap-2">
            <span v-if="finalResult.originalAmount" class="order-oldprice">{{ currency(finalResult.originalAmount).format() }}</span>
            <span v-if="finalResult.discountAmount" class="order-discount">{{ $t('立省 {value}', { value: currency(finalResult.discountAmount).format() }) }}</span>
          </div>
        </div>
      </div>
      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
      <RxAlert v-if="finalResult.needRecharge" class="w-full" type="warn" :title="$t('您当前的余额不足以支付此订单，请充值后继续。')" :closable="false" />
      <div class="flex flex-col gap-2.5">
        <div class="relative h-24 flex px-3 justify-end items-end overflow-hidden balance-bg">
          <img class="block absolute top-8 left-8" :src="imgSrc">
          <div class="flex items-baseline gap-4 py-4">
            <div class="balance-text">
              {{ $t('当前钱包余额') }}
            </div>
            <div class="balance-value">
              {{ currency(userPayInfo.balance).format() }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="finalResult.needRecharge" class="h-11 flex justify-end items-center gap-2.5 pr-3 total">
        <div class="total-title">
          {{ $t('应充值金额') }}
        </div>
        <div class="total-price">
          {{ currency(finalResult.needAmount).format() }}
        </div>
      </div>
      <div v-if="showAutoRenew && !finalResult.needRecharge" class="flex flex-col gap-5">
        <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
        <div class="flex flex-col">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <span class="auto-title">{{ $t('启用钱包自动续费') }}</span>
              <span class="auto-value">{{ formatDiscountOff(userPayInfo.autoRenewDiscount) }}</span>
            </div>
            <RxToggleSwitch v-model="isAuto" :before-change="beforeToggleAutoRenew" />
          </div>
          <div class="auto-desc">
            {{ $t('您可以在钱包中管理续订设置。') }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col">
      <RxButton v-if="finalResult.needRecharge" :disabled="loading" size="lg" :label="$t('前往充值')" @click="onRecharge" />
      <RxButton v-else :disabled="loading" size="lg" :label="$t('支付')" @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: normal;
}

.order {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: normal;
  }

  &-price {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 40px;
    font-weight: 700;
    line-height: normal;
  }

  &-oldprice {
    color: var(--colors-text-text-inactive);
    font-family: Inter;
    font-size: 14px;
    line-height: normal;
    text-decoration-line: line-through;
  }

  &-discount {
    color: var(--colors-text-text-warning);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }
}

.balance {
  &-danger {
    color: var(--colors-text-text-error);
    font-size: 14px;
    line-height: normal;
  }

  &-bg {
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      var(--pattern-pay-wallet-bg-start) -115.43%,
      var(--pattern-pay-wallet-bg-end) 167.02%
    );
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 14px;
    line-height: normal;
  }

  &-value {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }
}

.total {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 20px;
  }

  &-price {
    color: var(--colors-text-text-brand);
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }
}

.auto {
  &-title {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
  }

  &-value {
    color: var(--colors-text-text-warning);
    font-family: 'DingTalk JinBuTi';
    font-size: 14px;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
  }
}
</style>
