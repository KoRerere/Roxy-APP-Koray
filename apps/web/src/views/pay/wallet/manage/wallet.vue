<script setup lang="ts">
import ActivityInfoWallet from '/@/views/campaign/new-user/activity-info-wallet.vue'
import currency from 'currency.js'
// import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useUserStore } from '/@/stores/user'
import { OrderType } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
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
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <div>
        <div class="title">
          {{ $t('钱包') }}
        </div>
      </div>
    </div>
    <div class="relative flex flex-col justify-between pa-6 overflow-hidden gap-[32px] overview-item balance">
      <div class="flex flex-row justify-between items-center gap-4">
        <div class="balance-title">
          {{ $t('余额') }}
        </div>
        <div class="flex flex-row gap-1 items-center">
          <i18n-t class="balance-desc" tag="div" :keypath="$t('参与 {invite} 获得奖励', { invite: '{invite}' })" scope="global">
            <template #invite>
              <span class="cursor-pointer balance-desc-link" @click="router.push({ name: 'referral-program' })">{{
                $t('推广计划') }}
              </span>
            </template>
          </i18n-t>
          <!-- <SvgIcon class="cursor-pointer" name="base/rx_ic_arrow_right" size="20" color="#12A3FC" @click="router.push({ name: 'referral-program' })" /> -->
        </div>
      </div>

      <div>
        <div class="flex items-center gap-3">
          <div class="balance-value">
            {{ currency(userPayInfo.balance).format() }}
          </div>
          <SvgIcon class="balance-refresh-icon" :class="{
                     'balance-refresh-icon--spinning': props.balanceRefreshUi === 'loading',
                     'cursor-pointer': props.balanceRefreshUi === 'idle',
                   }" :name="props.balanceRefreshUi === 'success' ? 'base/rx_ic_check' : 'base/rx_ic_refresh'" size="20"
                   :color="props.balanceRefreshUi === 'success' ? 'var(--colors-icon-icon-success)' : 'var(--colors-icon-icon-secondary)'" @click="props.balanceRefreshUi === 'idle' && $emit('refresh')"
          />
        </div>
      </div>
      <RxButton class="fund-btn" severity="info" variant="outlined" size="lg" :label="$t('充值')" icon="base/rx_ic_credit_card" @click="onCharge" />
      <ActivityInfoWallet />
      <!-- <RxButton class="w-full btn-charge mb-[8px]" outlined severity="secondary" size="lg" :label="$t('充值')" icon="base/rx_ic_credit_card" @click="onCharge" /> -->
      <slot name="footer" />
    </div>
    <!-- <RxButton outlined severity="secondary" size="lg" icon="base/rx_ic_credit_card" :label="$t('充值')"
              @click="onCharge"
    /> -->
  </div>
</template>

<style scoped lang="scss">
.fund-btn {
  --button-outlined-info-border-color: #11a3fd;
}

.btn-charge {
  --colors-border-border-action-hover: #11a3fd;
  --button-outlined-secondary-border-color: #11a3fd;
  --button-outlined-secondary-color: #11a3fd;
  --colors-icon-icon-secondary: #11a3fd;
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--colors-border-border-brand, #11a3fd);
  background: var(--component-button-ghost-bg, #fff);

  /* shadow-sm */
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.balance {
  border-radius: 12px;
  border: 0.5px solid var(--colors-border-divider, #e2e9ee);
  background: var(--colors-background-bg-overlay, #fff);

  /* shadow-md */
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07);

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/images/payments/gradient_light.svg') no-repeat -300px -370px/960px 620px;
    z-index: -2;
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-family: Archivo, Inter;
    font-size: 16px;
    font-weight: 700;
    line-height: normal;
  }

  &-value {
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 40px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;

    &::first-letter {
      font-size: 32px;
    }
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;

    &-link {
      color: var(--Color-blue-300, #12a3fc);
      text-decoration-line: underline;
      text-decoration-style: solid;
      text-decoration-skip-ink: auto;
      text-decoration-thickness: auto;
      text-underline-offset: auto;
      text-underline-position: from-font;
    }
  }
}

.balance-refresh-icon {
  display: inline-flex;
  flex-shrink: 0;
  transform-origin: 50% 50%;

  &--spinning {
    animation: balance-refresh-spin 0.75s linear infinite;
  }
}

@keyframes balance-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

[data-theme='dark'] {
  .balance::after {
    background-image: url('/images/payments/gradient_dark.svg');
  }
}
</style>
