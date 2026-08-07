<script setup lang="ts">
import AgentTooltip from './AgentTooltip.vue'
import {
  AGENT_COPY_ICON,
  AGENT_COPY_SUCCESS_DURATION,
  AGENT_COPY_SUCCESS_ICON,
  copyAgentText,
} from './AgentCopyControl.shared'

const props = withDefaults(defineProps<{
  text?: string
  size?: number
  copiedDuration?: number
  ariaLabel?: string
  tooltip?: string
  copiedTooltip?: string
  disabled?: boolean
}>(), {
  text: '',
  size: 14,
  copiedDuration: AGENT_COPY_SUCCESS_DURATION,
})

const emit = defineEmits<{
  copied: [text: string]
  error: [error: unknown]
}>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof window.setTimeout> | null = null

const unavailable = computed(() => props.disabled || !props.text)
const label = computed(() => copied.value
  ? props.copiedTooltip || $t('已复制')
  : props.tooltip || props.ariaLabel || $t('复制'))
const iconName = computed(() => copied.value ? AGENT_COPY_SUCCESS_ICON : AGENT_COPY_ICON)

async function copy() {
  if (unavailable.value)
    return

  try {
    const didCopy = await copyAgentText(props.text)
    if (!didCopy)
      return

    copied.value = true
    emit('copied', props.text)

    if (copiedTimer)
      window.clearTimeout(copiedTimer)

    copiedTimer = window.setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, props.copiedDuration)
  }
  catch (error) {
    emit('error', error)
  }
}

onBeforeUnmount(() => {
  if (copiedTimer)
    window.clearTimeout(copiedTimer)
})
</script>

<template>
  <AgentTooltip :content="label" placement="top" :offset="8" :disabled="unavailable">
    <span
      class="agent-copy-control"
      :class="{ 'is-copied': copied, 'is-disabled': unavailable }"
      role="button"
      :tabindex="unavailable ? -1 : 0"
      :aria-label="label"
      @click.stop="copy"
      @keydown.enter.prevent.stop="copy"
      @keydown.space.prevent.stop="copy"
    >
      <SvgIcon :name="iconName" :size="size" color="currentColor" />
    </span>
  </AgentTooltip>
</template>

<style lang="scss" scoped>
.agent-copy-control {
  display: inline-grid;
  width: 18px;
  height: 18px;
  place-items: center;
  color: var(--color-text-tertiary);
  cursor: pointer;
  line-height: 1;
  outline: none;
  transition: color 0.16s ease, transform 0.16s ease, opacity 0.16s ease;

  &:hover,
  &:focus-visible {
    color: var(--color-text-secondary);
  }

  &:active {
    transform: scale(0.94);
  }

  &.is-copied {
    color: var(--color-text-success-primary);
  }

  &.is-disabled {
    cursor: default;
    opacity: 0.45;
    pointer-events: none;
  }

  :deep(.svg) {
    color: currentColor;
  }
}
</style>
