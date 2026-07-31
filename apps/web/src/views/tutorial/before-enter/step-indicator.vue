<script setup lang="ts">
const { current = 0 } = defineProps<{
  /** 当前步骤索引，从 0 开始 */
  current?: number
}>()

const steps = [
  {
    label: $t('选一台跨境电商账号设备'),
    tooltip: $t('设备可为您的店铺提供独立、专属的网络环境。店铺账号需绑定对应的专属网络后方可正常访问。完成绑定后，无论您在何处通过 Roxy 浏览器登录该账号，均会使用同一固定 IP 地址进行网络访问。'),
  },
  {
    label: $t('选择跨境电商平台'),
  },
  {
    label: $t('成功'),
  },
]

type StepStatus = 'done' | 'active' | 'upcoming'

/** 根据当前进度推导各步骤视觉态 */
function getStepStatus(index: number): StepStatus {
  if (index < current)
    return 'done'
  if (index === current)
    return 'active'
  return 'upcoming'
}

function getStepTextClass(index: number) {
  const status = getStepStatus(index)
  if (status === 'active')
    return 'step-text step-text--active'
  if (status === 'done')
    return 'step-text step-text--done'
  return 'step-text step-text--upcoming'
}

/** 仅当前步骤后的箭头使用品牌色，其余为弱化态 */
function getArrowColor(index: number) {
  return getStepStatus(index) === 'active'
    ? 'var(--colors-icon-icon-brand)'
    : 'var(--colors-icon-icon-inactive)'
}
</script>

<template>
  <div class="flex items-center justify-center gap-3 select-none">
    <template v-for="(item, index) in steps" :key="index">
      <div class="flex items-center gap-1.5" :class="getStepTextClass(index)">
        <span>{{ item.label }}</span>
        <SvgIcon v-if="item.tooltip" v-tooltip.top="{ value: item.tooltip, pt: { root: '!max-w-80' } }" name="base/rx_ic_question" color="var(--colors-icon-icon-note)" />
      </div>
      <SvgIcon v-if="index < steps.length - 1" name="base/rx_ic_play" size="12" :color="getArrowColor(index)" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.step-text {
  font-size: 28px;
  line-height: normal;
  font-weight: 500;
  letter-spacing: -0.14px;
  white-space: nowrap;

  &--done {
    color: var(--colors-text-text-primary);
  }

  &--active {
    font-weight: 600;
    color: var(--colors-text-text-brand);
  }

  &--upcoming {
    color: var(--colors-text-text-inactive);
  }
}
</style>
