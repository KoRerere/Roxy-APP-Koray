<script setup lang="ts">
import { useBankCards } from '/@/views/pay/wallet/hook.tsx'

type BankCard = NonNullable<typeof userCards.value>[number]

const { userCards, autoRecharge, matchCard, checkAutoRecharge, bindCard, onMenuCommand, setMainCard } = useBankCards()

/** 点击卡片行：设为默认卡（默认卡即选中项） */
function onSelect(card: BankCard) {
  if (card.cardDefault) {
    return
  }
  setMainCard(card.cardId)
}
</script>

<template>
  <!-- 付款卡片面板：上移压在钱包卡渐隐区域之上 -->
  <div class="relative z-1 flex flex-col gap-6 px-5 pt-5 pb-6 rounded-3 panel">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="tt-primary text-3.5 font-600 leading-5">
            {{ $t('付款卡片') }}
          </div>
          <div class="tt-secondary text-3 leading-4">
            {{ $t('默认卡片将用于续费。') }}
          </div>
        </div>
        <RxButton class="shrink-0" severity="secondary" outlined size="sm" icon="base/rx_ic_plus" :disabled="!!userCards && userCards.length >= 4" :label="$t('新增卡片')" @click="bindCard()" />
      </div>

      <div v-if="!userCards?.length" class="flex flex-col items-center justify-center gap-2 h-30 rounded-1.5 empty">
        <SvgIcon name="base/rx_ic_credit_card" size="24" color="var(--colors-icon-icon-note)" />
        <span class="tt-tertiary text-3.5">{{ $t('暂无绑定卡片') }}</span>
      </div>

      <div v-else class="flex flex-col gap-2">
        <div v-for="card in userCards" :key="card.cardId" class="group flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-1.5 cursor-pointer card-row"
             :class="{ 'card-row--active': card.cardDefault }" @click="onSelect(card)"
        >
          <div class="flex-1 min-w-0 flex items-center gap-2.5">
            <div class="radio" :class="{ 'radio--checked': card.cardDefault }" />
            <SvgIcon class="shrink-0" :name="matchCard(card.brand!)" size="32" />
            <span class="text-3.25 leading-normal font-['JetBrains_Mono'] whitespace-nowrap" :class="card.cardDefault ? 'tt-primary font-500' : 'tt-secondary'">**** {{ card.last4 }}</span>
            <span v-if="card.cardDefault" class="px-1 py-0.5 rounded-1 text-3 leading-4 font-500 font-['JetBrains_Mono'] default-tag">{{ $t('默认') }}</span>
          </div>
          <RxButton class="shrink-0" :class="card.cardDefault ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'" text severity="secondary" size="xxs"
                    icon="base/rx_ic_more-v" @click.stop="onMenuCommand($event, card)"
          />
        </div>
      </div>
    </div>

    <!-- 组合支付 -->
    <div class="flex flex-col gap-2">
      <div class="h-6 flex items-center gap-2">
        <div class="flex-1 tt-primary text-3.5 font-600 leading-5">
          {{ $t('组合支付') }}
        </div>
        <RxToggleSwitch v-model="autoRecharge" true-value="1" false-value="0" @change="checkAutoRecharge" />
      </div>
      <div class="tt-tertiary text-3.5 leading-5">
        {{ $t('当钱包余额不足以自动续费时，将使用默认银行卡扣款。') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel {
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: rgba(242, 245, 247, 0.6);
  // Figma 背景模糊 32 ≈ CSS blur(16px)
  backdrop-filter: blur(16px);
}

.empty {
  border: 1px dashed var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-page, #fff);
}

.card-row {
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: var(--colors-background-bg-page, #fff);
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--component-alert-announcement-border-info, #3fb6fd);
  }

  &--active {
    border-color: var(--component-alert-announcement-border-info, #3fb6fd);
    background: var(--component-alert-bg-info, #c8ebfe);
  }
}

.radio {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-page, #fff);
  transition: border 0.15s;

  &--checked {
    border: 5px solid var(--colors-border-border-brand, #11a3fd);
  }
}

.default-tag {
  color: var(--colors-text-text-inactive, #7d8387);
  border: 0.5px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-page, #fff);
}
</style>

<style lang="scss">
// 深色模式：取自设计稿深色页面
[data-theme='dark'] {
  .panel {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(39, 60, 72, 0.6);
  }
}
</style>
