<script setup lang="ts">
const props = withDefaults(defineProps<{
  ariaLabel?: string
  disabled?: boolean
  max?: number
  readonly?: boolean
  showEmpty?: boolean
  size?: number | string
  value?: number
}>(), {
  max: 5,
  readonly: true,
  showEmpty: false,
  size: 12,
  value: 5,
})

const modelValue = defineModel<number>()
const starPath = 'M5.49887 0C6.09332 0 6.5397 0.447889 6.81235 1.00001L7.69224 2.77443L7.69419 2.77785C7.7098 2.80998 7.75773 2.87309 7.84165 2.93556C7.92536 2.99784 8.00065 3.02648 8.03745 3.03273H8.03696L9.63169 3.29982H9.63218C10.2302 3.40033 10.7689 3.70038 10.9461 4.25588C11.1232 4.81119 10.8583 5.36904 10.4281 5.79983L10.4276 5.79935L9.18931 7.04838C9.15885 7.07914 9.11271 7.15202 9.08238 7.25883C9.05283 7.36294 9.05235 7.45024 9.06187 7.49711L9.41685 9.04448V9.04497C9.56617 9.69837 9.53144 10.4069 9.01353 10.7877C8.49353 11.1697 7.80794 10.9866 7.23374 10.6446L7.23325 10.6441L5.73862 9.752H5.73813C5.69938 9.72892 5.61527 9.70174 5.5018 9.70171C5.38865 9.70175 5.30086 9.72862 5.25766 9.75396L3.76645 10.6436C3.19225 10.9871 2.50745 11.1681 1.98764 10.7857C1.47046 10.4051 1.43288 9.69797 1.58285 9.04448L1.93686 7.50053C1.94708 7.45455 1.9476 7.36546 1.91733 7.25883C1.88695 7.15189 1.84036 7.07909 1.8099 7.04838L0.570156 5.79837C0.143117 5.36773 -0.120413 4.81089 0.0550184 4.25686C0.231125 3.70095 0.769025 3.40045 1.36752 3.29982L2.96078 3.03273L2.99301 3.02443C3.03194 3.0112 3.08958 2.98319 3.15268 2.93605C3.2365 2.87333 3.28442 2.81014 3.30014 2.77785L3.30209 2.77443L4.18198 1.00001L4.18247 0.999029C4.4575 0.447327 4.90519 0.000234739 5.49887 0Z'

const normalizedMax = computed(() => Math.max(1, Math.floor(props.max)))
const currentValue = computed(() => {
  const value = modelValue.value ?? props.value
  return Math.min(normalizedMax.value, Math.max(0, Math.floor(value)))
})
const renderedStars = computed(() => props.showEmpty ? normalizedMax.value : currentValue.value)
const starSize = computed(() => Number.isNaN(Number(props.size)) ? String(props.size) : `${props.size}px`)
const interactive = computed(() => !props.readonly && !props.disabled)

function selectRating(value: number) {
  if (interactive.value)
    modelValue.value = value
}
</script>

<template>
  <span
    class="agent-rating"
    :class="{ 'agent-rating--interactive': interactive, 'agent-rating--disabled': props.disabled }"
    :aria-label="props.ariaLabel ?? `${currentValue} / ${normalizedMax}`"
    role="img"
  >
    <span
      v-for="index in renderedStars"
      :key="index"
      class="agent-rating__star"
      :class="{ 'agent-rating__star--empty': index > currentValue }"
      :role="interactive ? 'button' : undefined"
      :tabindex="interactive ? 0 : undefined"
      @click="selectRating(index)"
      @keydown.enter.prevent="selectRating(index)"
      @keydown.space.prevent="selectRating(index)"
    >
      <svg viewBox="0 0 11.0018 11.0009" aria-hidden="true" focusable="false">
        <path :d="starPath" />
      </svg>
    </span>
  </span>
</template>

<style scoped lang="scss">
.agent-rating {
  display: inline-flex;
  align-items: center;
  gap: 1.5px;
  color: #eaaa08;
  vertical-align: middle;
}

.agent-rating__star {
  display: inline-flex;
  width: v-bind(starSize);
  height: v-bind(starSize);
  align-items: center;
  justify-content: center;
  color: inherit;

  svg {
    display: block;
    width: 91.6667%;
    height: 91.6667%;
    fill: currentColor;
  }
}

.agent-rating__star--empty {
  color: var(--color-border-primary);
}

.agent-rating--interactive .agent-rating__star {
  cursor: pointer;

  &:focus-visible {
    border-radius: 4px;
    outline: 2px solid color-mix(in srgb, currentColor 24%, transparent);
    outline-offset: 2px;
  }
}

.agent-rating--disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
