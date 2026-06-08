<script setup lang="ts">
import type { MessageEntry } from '../../types'
import { formatElapsedDuration, formatThinkingDuration } from '../../hooks/useMessageItem'
import { useSharedNow } from '../../hooks/useSharedNow'

const props = defineProps<{
  thinking: MessageEntry
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const duration = computed(() => formatThinkingDuration(props.thinking))
const now = useSharedNow(() => !!props.thinking.isThinking)
const liveDuration = computed(() => formatElapsedDuration(props.thinking.start ?? (props.thinking as any).startTimestamp, now.value))
const isExpanded = computed(() => props.thinking.isThinking || props.expanded)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-1 cursor-pointer select-none hover:opacity-80" @click.stop="emit('toggle')">
      <span v-if="thinking.isThinking" class="title">
        {{ $t('思考中... ({duration})', { duration: liveDuration }) }}
      </span>
      <span v-else class="title">{{ $t('思考 {thinking}', { thinking: duration }) }}</span>
      <SvgIcon v-if="thinking.isThinking" class="loading-circle" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
      <SvgIcon class="arrow" :class="{ 'rotate-90': isExpanded }" name="base/rx_ic_chevron_right" size="14" />
    </div>
    <div v-if="isExpanded && thinking.text" class="ml-4 pa-2 rounded-1 content" @click.stop>
      {{ thinking.text }}
    </div>
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
