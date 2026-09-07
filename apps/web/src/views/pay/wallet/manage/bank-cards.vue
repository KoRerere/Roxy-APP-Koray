<script setup lang="ts">
import { useBankCards } from '/@/views/pay/wallet/hook.tsx'

const { userCards, autoRecharge, matchCard, checkAutoRecharge, bindCard, onMenuCommand } = useBankCards()
</script>

<template>
  <div class="h-full flex flex-col justify-between pa-2 bank-cards">
    <div class="flex flex-col gap-2 pa-2.5">
      <div class="flex justify-between items-center">
        <div class="tt-primary text-3.5 font-600 leading-5">
          {{ $t('组合支付') }}
        </div>
        <RxToggleSwitch v-model="autoRecharge" true-value="1" false-value="0" @change="checkAutoRecharge" />
      </div>
      <div class="tt-tertiary text-3.5 leading-5">
        {{ $t('当钱包余额不足以自动续费时，自动用卡片组合支付。') }}
        {{ $t('（仅默认卡片会被用于组合支付）') }}
      </div>
    </div>

    <div class="flex flex-col gap-2.5 pa-3 panel">
      <div class="flex justify-between items-center">
        <div class="tt-primary text-3.5 font-600 leading-5">
          {{ $t('卡片信息') }}
        </div>
        <RxButton variant="outlined" severity="info" size="xxs" :disabled="userCards && userCards.length >= 4" :label="`+ ${$t('新增')}`" @click="bindCard()" />
      </div>
      <div v-if="!userCards?.length" class="tt-tertiary text-3.5 leading-5">
        {{ $t('暂无绑定卡片') }}
      </div>
      <div v-else-if="userCards.length === 1" class="h-10 flex justify-between items-center">
        <div class="flex items-center gap-2.5 min-w-0">
          <SvgIcon :name="matchCard(userCards[0].brand!)" size="32" />
          <span class="card-number">{{ `**** **** **** ${userCards[0].last4}` }}</span>
          <span v-if="userCards[0].cardDefault" class="card-default">DEFAULT</span>
        </div>
        <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_more-v" @click="onMenuCommand($event, userCards[0])" />
      </div>
      <div v-else class="grid grid-cols-4 gap-1 min-w-0">
        <div v-for="card in userCards" :key="card.cardId" class="h-10 flex items-center gap-1 px-2 rounded-1 min-w-0 overflow-hidden cursor-pointer"
             :class="card.cardDefault ? 'card-chip--default' : 'card-chip'" @click="onMenuCommand($event, card)"
        >
          <SvgIcon :name="matchCard(card.brand!)" size="32" />
          <span class="truncate text-3.5 font-500 font-['JetBrains_Mono']" :class="card.cardDefault ? 'color-white' : 'tt-primary'">{{ card.last4 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bank-cards {
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-page, #fff);
}

.panel {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: var(--colors-background-bg-block, #f1f5f8);
}

.card-chip {
  border: 0.5px solid var(--colors-border-border-inactive, #e2e9ee);
  background: var(--colors-background-bg-page, #fff);
}

.card-chip--default {
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: linear-gradient(262deg, #34d0a0 -0.48%, #afe42c 100.91%);
}

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
