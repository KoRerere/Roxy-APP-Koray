<script setup lang="ts">
import type { TextareaProps } from 'primevue/textarea'
import Textarea from 'primevue/textarea'

interface Props extends /* @vue-ignore */ Omit<TextareaProps, 'size'> {}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<string | null>()
const props = withDefaults(defineProps<Props>(), {
  rows: 4,
})
const attrs = useAttrs()
const textareaRef = useTemplateRef<{ $el: HTMLTextAreaElement }>('textarea')

defineExpose({
  focus: () => textareaRef.value?.$el.focus(),
  blur: () => textareaRef.value?.$el.blur(),
})
</script>

<template>
  <Textarea
    ref="textarea"
    v-model="modelValue"
    class="agent-textarea"
    v-bind="{ ...attrs, ...props }"
    fluid
  />
</template>

<style lang="scss" scoped>
.agent-textarea {
  width: 100%;
  min-height: 88px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;
  resize: vertical;

  &::placeholder {
    color: var(--color-text-disabled);
  }

  &:enabled:hover {
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary-hover);
  }

  &:enabled:focus {
    border-color: var(--color-border-primary-inverse);
    background: var(--color-bg-primary);
  }

  &:disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;
    opacity: 1;
    resize: none;
  }
}
</style>
