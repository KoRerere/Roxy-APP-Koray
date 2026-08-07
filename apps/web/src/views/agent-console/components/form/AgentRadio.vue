<script setup lang="ts">
type RadioValue = boolean | number | string

const props = withDefaults(defineProps<{
  ariaLabel?: string
  ariaLabelledby?: string
  disabled?: boolean
  inputId?: string
  name?: string
  readonly?: boolean
  tabindex?: number
  value?: RadioValue
}>(), {
  value: true,
})

const modelValue = defineModel<RadioValue | null>()
const fallbackId = useId()
const inputId = computed(() => props.inputId || `agent-radio-dot-${fallbackId}`)
const checked = computed(() => modelValue.value === props.value)

function selectValue() {
  if (!props.disabled && !props.readonly)
    modelValue.value = props.value
}
</script>

<template>
  <span class="agent-radio" :class="{ 'agent-radio--checked': checked, 'agent-radio--disabled': props.disabled }">
    <input
      :id="inputId"
      class="agent-radio__native"
      type="radio"
      :checked="checked"
      :name="props.name"
      :value="String(props.value)"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :tabindex="props.tabindex"
      :aria-label="props.ariaLabel"
      :aria-labelledby="props.ariaLabelledby"
      @change="selectValue"
    >
    <span class="agent-radio__mark" aria-hidden="true" @click="selectValue">
      <span v-if="checked" />
    </span>
  </span>
</template>

<style scoped lang="scss">
.agent-radio {
  position: relative;
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.agent-radio__native {
  position: absolute;
  inset: 0;
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  opacity: 0;
}

.agent-radio__mark {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-primary);
  border-radius: 9999px;
  background: var(--color-bg-primary);
  pointer-events: none;

  span {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--color-bg-primary);
  }
}

.agent-radio--checked .agent-radio__mark {
  border-color: var(--color-bg-primary-inverse);
  background: var(--color-bg-primary-inverse);
}

.agent-radio:focus-within .agent-radio__mark {
  outline: 2px solid color-mix(in srgb, var(--color-border-primary-inverse) 12%, transparent);
  outline-offset: 2px;
}

.agent-radio--disabled {
  cursor: not-allowed;
  opacity: 0.45;

  .agent-radio__native {
    cursor: not-allowed;
  }
}
</style>
