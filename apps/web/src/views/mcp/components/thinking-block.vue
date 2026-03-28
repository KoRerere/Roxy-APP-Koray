<script setup lang="ts">
import type { MessageEntry } from '../types'
import { formatThinkingDuration } from '../composables/useMessageItem'

const props = defineProps<{
  thinking: MessageEntry
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const duration = computed(() => formatThinkingDuration(props.thinking))
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- 思考中状态 -->
    <div v-if="thinking.isThinking" class="flex items-center gap-1 title">
      <span>{{ $t('思考中...') }}</span>
      <SvgIcon class="loading-circle" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
    </div>
    <!-- 已完成状态 -->
    <template v-else>
      <div class="flex items-center gap-1 cursor-pointer select-none hover:opacity-80" @click.stop="emit('toggle')">
        <span class="title">{{ $t('思考 {thinking}', { thinking: duration }) }}</span>
        <SvgIcon class="arrow" :class="{ 'rotate-90': expanded }" name="base/rx_ic_chevron_right" size="14" />
      </div>
      <div v-if="expanded" class="ml-4 pa-2 rounded-1 content" @click.stop>
        {{ thinking.text }}
      </div>
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
  background: var(--colors-background-bg-subtle);
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
