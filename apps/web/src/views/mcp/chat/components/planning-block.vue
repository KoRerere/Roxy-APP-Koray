<script setup lang="ts">
import type { PlanningState } from '../../types'
import { formatPlanningDuration } from '../../hooks/useMessageItem'

const props = defineProps<{
  planningState: PlanningState
  planningText?: string
}>()

const expanded = ref(false)

const planningDuration = computed(() => {
  if (!props.planningState)
    return ''
  return formatPlanningDuration(props.planningState)
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- 规划中状态 -->
    <div v-if="planningState?.isPlanning" class="flex items-center gap-1 title">
      <span>{{ $t('规划中...') }}</span>
      <SvgIcon class="loading-circle" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
    </div>
    <!-- 已完成状态 -->
    <template v-else>
      <div class="flex items-center gap-1 cursor-pointer select-none hover:opacity-80" @click.stop="expanded = !expanded">
        <span class="title">{{ $t('规划 {duration}', { duration: planningDuration }) }}</span>
        <SvgIcon v-if="planningText" class="arrow" :class="{ 'rotate-90': expanded }" name="base/rx_ic_chevron_right" size="14" />
      </div>
      <code v-if="planningText && expanded" class="ml-4 pa-2 rounded-1 content">
        {{ planningText }}
      </code>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.arrow {
  color: var(--colors-text-text-tertiary);
  transition: transform 0.2s;
}

.title {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.content {
  background: var(--colors-background-bg-block);
  color: var(--colors-text-text-tertiary);
  font-family: JetBrains Mono;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
