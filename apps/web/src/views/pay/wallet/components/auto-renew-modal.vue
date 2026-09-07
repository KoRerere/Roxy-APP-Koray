<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useBankCards, usePay } from '/@/views/pay/wallet/hook.tsx'
import { OrderType } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'

defineOptions({
  inheritAttrs: false,
})

const { onConfirm } = defineProps<{
  onConfirm: () => Promise<void> | void
}>()

defineEmits(['close'])

const notShowAgain = ref(false)

async function _confirm() {
  // 先落盘再回调，避免父级立刻关弹窗导致勾选未写入
  if (notShowAgain.value) {
    localStorage.setItem('autoRenewModalNotShowAgain', 'true')
  }
  await onConfirm()
}

const { isDarkTheme } = storeToRefs(useThemeStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const { userCards, autoRecharge, matchCard, checkAutoRecharge, bindCard, onMenuCommand } = useBankCards()

/**
 * 打开钱包充值流程，完成后刷新余额与账单
 */
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

const imgSrc = computed(() => {
  return isDarkTheme.value ? getImage('payments/dark/wallet.svg') : getImage('payments/light/wallet.svg')
})

const cardBgSrc = computed(() => {
  return isDarkTheme.value ? getImage('payments/dark/wallet_card.svg') : getImage('payments/light/wallet_card.svg')
})
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 rounded-lg w-140">
    <div class="h-9 flex items-center justify-between">
      <span class=" tt-primary text-4 font-600 leading-normal">{{ $t('自动续费') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>

    <RxAlert class="-mt-1 w-full" type="info" :closable="false" :title="$t('为了您业务稳定运行，建议保持余额充足或绑定快捷支付。')" />

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <div class=" tt-primary text-3.5 font-600 leading-5">
          {{ $t('续费扣款保障') }}
        </div>
        <div class=" tt-tertiary text-3 leading-normal">
          {{ $t('钱包余额不足时，可从已关联的快捷支付方式补扣') }}
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <div class="relative h-20 flex pl-5 pr-6 gap-6 items-center rounded-2 overflow-hidden">
          <img :src="cardBgSrc" draggable="false" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none">
          <div class="relative z-1 overflow-hidden">
            <img class="block translate-y-2" :src="imgSrc">
          </div>
          <div class="relative z-1 flex flex-col gap-1 flex-1">
            <div class="tt-secondary text-3 leading-normal">
              {{ $t('当前钱包余额') }}
            </div>
            <div class="tt-primary text-5 font-600 leading-normal">
              {{ currency(userPayInfo.balance).format() }}
            </div>
          </div>
          <RxButton class="relative z-1" :label="$t('充值')" @click="onCharge" />
        </div>
      </div>

      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-overlay)" />
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class=" tt-primary text-3.5 font-600 leading-5">{{ $t('组合支付') }}</span>
          <RxToggleSwitch v-model="autoRecharge" true-value="1" false-value="0" @change="checkAutoRecharge" />
        </div>
        <div class=" tt-tertiary text-3 leading-normal">
          {{ $t('钱包余额不足以自动续费时，自动用默认银行卡补扣。') }}
        </div>
      </div>
      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-overlay)" />

      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class=" tt-primary text-3.5 font-600 leading-5">{{ $t('卡片信息') }}</span>
          <RxButton severity="info" variant="outlined" size="xxs" icon="base/rx_ic_plus" :label="$t('新增')" :disabled="userCards && userCards.length >= 4" @click="bindCard()" />
        </div>
        <div v-if="!userCards?.length" class="tt-tertiary text-3.5 leading-5">
          {{ $t('暂无绑定卡片') }}
        </div>
        <template v-if="!!userCards?.length">
          <div v-for="card in userCards" :key="card.cardId" class="h-10 flex justify-between items-center">
            <div class="flex items-center gap-2.5">
              <SvgIcon :name="matchCard(card.brand!)" size="32" />
              <span class="card-number">{{ `**** **** **** ${card.last4}` }}</span>
              <span v-if="card.cardDefault" class="card-default">DEFAULT</span>
            </div>
            <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_more-v" @click="onMenuCommand($event, card)" />
          </div>
        </template>
      </div>

      <div class="tt-secondary text-3.25 leading-4.5">
        <div>{{ $t('距离到期时间不足 {hours} 小时的代理 IP，开启后将立即执行续费。', { hours: 1 }) }}</div>
        <div>{{ $t('到期前 {hours} 小时无法修改自动续费开关。', { hours: 1 }) }}</div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="flex-1 flex items-center gap-2.5">
        <RxCheckbox v-model="notShowAgain" input-id="notShowAgain" binary />
        <label for="notShowAgain" class="tt-secondary text-3.5 leading-5 select-none">{{ $t('不再提醒') }}</label>
      </div>
      <RxButton severity="secondary" variant="outlined" :label="$t('关闭')" @click="$emit('close')" />
      <RxButton :label="$t('开启')" @click="_confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  &-number {
    color: var(--colors-text-text-tertiary);
    font-family: 'JetBrains Mono';
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
    font-family: 'JetBrains Mono';
    font-size: 10px;
    font-weight: 800;
    line-height: normal;
  }
}
</style>
