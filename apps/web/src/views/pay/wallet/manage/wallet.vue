<script setup lang="ts">
import currency from 'currency.js'
import { $t } from '/@/locales';
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { useUserStore } from '/@/stores/user';
import { OrderType } from '/@/enums/pay';
import { emitter } from '/@/utils/eventBus';

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { walletRecharge, openProcessing } = usePay()

function onCharge() {
  walletRecharge({
    next: data => {
      openProcessing(data, OrderType.Recharge)
        .finally(() => {
          emitter.emit('updateBillList')
        })
    }
  })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="title">{{ $t('钱包') }}</div>
    <div class="relative flex flex-col justify-between pa-4 h-55 overflow-hidden overview-item balance">
      <div class="balance-title">{{ $t('Roxy 钱包') }}</div>
      <div>
        <div class="balance-value">{{ currency(userPayInfo.balance).format() }}</div>
        <i18n-t class="mt-1.5 balance-desc" tag="div" :keypath="$t('参与 {invite} 获得奖励', { invite: '{invite}' })" scope="global">
          <template #invite>
            <span class="cursor-pointer balance-desc-link" @click="router.push({ name: 'referral-program' })">{{
              $t('推广计划') }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
    <RxButton outlined severity="secondary" size="lg" icon="base/rx_ic_credit_card" :label="$t('充值')" @click="onCharge"></RxButton>
  </div>
</template>

<style scoped lang="scss">
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.balance {
  border-radius: 12px;
  border: 0.5px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-overlay);
  box-shadow: 0 3px 8px 0 rgba(0, 0, 0, 0.07), 0 2px 5px 0 rgba(0, 0, 0, 0.07), 0 1px 1px 0 rgba(0, 0, 0, 0.07);
  z-index: 1;

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
    font-size: 20px;
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
      color: var(--pattern-sidenav-text-active);
      text-decoration-line: underline;
      text-decoration-style: solid;
      text-decoration-skip-ink: auto;
      text-decoration-thickness: auto;
      text-underline-offset: auto;
      text-underline-position: from-font;
    }
  }
}

[data-theme="dark"] {
  .balance::after {
    background-image: url('/images/payments/gradient_dark.svg');
  }
}
</style>
