<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import RadioButton from 'primevue/radiobutton'

type RadioValue = string | number | boolean

interface Props {
  ariaLabel?: string
  ariaLabelledby?: string
  description?: string
  disabled?: boolean
  icon?: SvgNames
  inputId?: string
  name?: string
  readonly?: boolean
  tabindex?: number
  title: string
  tone?: 'default' | 'gradient'
  value: RadioValue
}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<RadioValue | null>()
const props = withDefaults(defineProps<Props>(), {
  tone: 'default',
})

const attrs = useAttrs()
const fallbackId = useId()
const inputId = computed(() => props.inputId || `agent-radio-${props.value}-${fallbackId}`)
const selected = computed(() => modelValue.value === props.value)

function selectValue() {
  if (!props.disabled && !props.readonly) {
    modelValue.value = props.value
  }
}
</script>

<template>
  <label
    v-bind="attrs"
    class="agent-radio-card"
    :class="{ 'agent-radio-card--selected': selected, 'agent-radio-card--disabled': props.disabled }"
    :for="inputId"
    @click="selectValue"
  >
    <span class="agent-radio-card__copy">
      <span class="agent-radio-card__title" :class="{ 'agent-radio-card__title--gradient': props.tone === 'gradient' }">
        <SvgIcon v-if="props.icon" :name="props.icon" size="16" />
        <slot name="title">{{ props.title }}</slot>
      </span>
      <span v-if="props.description || $slots.description" class="agent-radio-card__description">
        <slot name="description">{{ props.description }}</slot>
      </span>
    </span>

    <RadioButton
      class="agent-radio-card__native"
      :model-value="modelValue"
      :input-id="inputId"
      :value="props.value"
      :name="props.name"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :tabindex="props.tabindex"
      :aria-label="props.ariaLabel"
      :aria-labelledby="props.ariaLabelledby"
      @change="selectValue"
    />

    <span class="agent-radio-card__mark" :class="{ 'agent-radio-card__mark--selected': selected }" aria-hidden="true">
      <span v-if="selected" />
    </span>
  </label>
</template>

<style lang="scss" scoped>
.agent-radio-card {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.agent-radio-card--selected {
  border-color: var(--color-bg-primary);
}

.agent-radio-card--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.agent-radio-card__copy,
.agent-radio-card__title {
  display: flex;
  min-width: 0;
}

.agent-radio-card__copy {
  flex-direction: column;
  gap: 2px;
}

.agent-radio-card__title {
  align-items: center;
  gap: 2px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.agent-radio-card__title--gradient {
  color: transparent;
  background: var(--agent-gradient, linear-gradient(127deg, #3faaf6 10.127%, #f359dc 44.937%, #f28fb0 100%));
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.agent-radio-card__description {
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-radio-card__native {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.agent-radio-card__mark {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 9999px;
  background: var(--color-bg-primary);
}

.agent-radio-card__mark--selected {
  border-color: var(--color-bg-primary);
  background: var(--color-bg-primary);

  span {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--color-bg-primary);
  }
}

.agent-radio-card:focus-within .agent-radio-card__mark {
  border-color: var(--color-bg-primary);
}
</style>
