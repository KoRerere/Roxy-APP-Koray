<script setup lang="ts">
import { useUserStore } from '/@/stores/user';
import type { Plan } from '../type';
import currency from 'currency.js';
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay.ts'
import { $t } from '/@/locales';
import { formatNumberToKMB } from '/@/utils/basic';

interface Props {
  list?: Plan[]
}
const emit = defineEmits(['change'])
const selectedPlan = defineModel<Plan>('modelValue')
const { list } = defineProps<Props>()

const { userPayInfo } = storeToRefs(useUserStore())

const subscribePlans = computed(() => {
  const { maxWindowCount, freeWindowCount } = userPayInfo.value
  const currentWindowCount = currency(maxWindowCount).subtract(freeWindowCount).value

  return Object.values((list || []).reduce((acc, item) => {
    acc[item.subLevel] ??= { ...item }
    acc[item.subLevel].windowPrice = Math.min(acc[item.subLevel].windowPrice!, item.windowPrice)
    acc[item.subLevel].minWindows = Math.min(acc[item.subLevel].minWindows!, item.minWindows)
    acc[item.subLevel].maxWindows = Math.max(acc[item.subLevel].maxWindows!, item.maxWindows)
    acc[item.subLevel].disabled = !userPayInfo.value.isAuto && currentWindowCount > acc[item.subLevel].maxWindows!
    acc[item.subLevel].tierCount = $t('{min}-{max} 窗口', {
      min: formatNumberToKMB(Math.max(list![0].maxWindows, acc[item.subLevel].minWindows!)),
      max: formatNumberToKMB(acc[item.subLevel].maxWindows!)
    })
    return acc
  }, { free: { subLevel: 'Free', tierCount: $t('{count} 个窗口', { count: userPayInfo.value.freeWindowCount }), logDays: 3, apiRate: 50, disabled: true } } as Record<string, Partial<Plan>>))
})

function onSwitchPlan(plan: Partial<Plan>) {
  if (plan.disabled) return
  // 获取原始阶梯中的数据
  const _plan = list!.find(item => item.maxWindows === plan.maxWindows)!
  selectedPlan.value = _plan
  emit('change', toRaw(_plan))
}

</script>

<template>
  <div class="flex gap-2">
    <div v-for="item in subscribePlans" :key="item.subLevel" class="relative flex-1 flex flex-col gap-1.5 pt-3 pb-2 px-4 rounded-lg select-none cursor-pointer plans" :class="{
      active: item.subLevel === selectedPlan?.subLevel,
      'cursor-not-allowed disabled': item.disabled
    }" @click="onSwitchPlan(item)">
      <div class="absolute top-0 right-1.5 -translate-y-1/2 py-0.5 px-2 rounded-full plans-current" :class="{ 'free': item.subLevel === 'Free' }" v-if="item.subLevel === userPayInfo?.subLevel">{{
        $t('当前套餐') }}</div>
      <div class="plans-text">
        {{ SubLevelEnumStr[item.subLevel as SubLevelEnum] }}
      </div>
      <div class="plans-price" :class="{ 'opacity-0': item.subLevel === SubLevelEnum.Trial }" v-if="item.windowPrice">{{ item.tierCount }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.plans {
  border: 2px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &.disabled {
    border: 1px solid var(--pattern-pay-plan-border-plan-inactive, #293038);
    background: var(--pattern-pay-plan-bg-plan-inactive, #05101A);
    box-shadow: none;

    .plans-text,
    .plans-price {
      color: var(--pattern-pay-plan-text-plan-inactive);
    }
  }

  &:not(.disabled).active {
    border: 2px solid transparent;
    background:
      linear-gradient(var(--colors-background-bg-action), var(--colors-background-bg-action)) padding-box,
      linear-gradient(var(--angle), #12a3fc, #ec51f7) border-box;
    animation: 8s rotate linear infinite;
    box-shadow: none;

    .plans-text,
    .plans-price {
      color: var(--pattern-pay-plan-text-plan-selected, #3FB6FD);
    }
  }

  &-current {
    background: linear-gradient(90deg, #8780FE 0%, #C491F1 100%);
    color: #FFF;
    font-family: "DingTalk JinBuTi", Inter, sans-serif;
    font-size: 12px;
    line-height: normal;

    &.free {
      background: var(--pattern-pay-plan-bg-tag-current);
    }
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 20px;
    font-weight: 700;
    line-height: 24px;
  }

  &-price {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 20px;
  }
}

@keyframes rotate {
  to {
    --angle: 360deg;
  }
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
</style>
