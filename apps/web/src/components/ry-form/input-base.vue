<script setup lang="ts">
import inputLabel from './input-label.vue'

defineOptions({
  inheritAttrs: false,
})

defineProps({
  name: String,
  type: {
    type: String,
    default: 'text',
  },
  labelPosition: {
    type: String,
    default: 'top',
  },
  icon: String,
  leftIcon: String,
})

defineEmits(['iconClick'])
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot>
      <slot name="label">
        <input-label class="input-label" :name="name" v-bind="$attrs" />
      </slot>
      <IconField v-if="type !== 'password'" class="w-full">
        <InputIcon v-if="leftIcon">
          <span :class="leftIcon" class="rx-icon cursor-pointer" @click="$emit('iconClick')" />
        </InputIcon>

        <Textarea v-if="type === 'textarea'" :id="name" class="w-full" rows="5" cols="30" auto-resize v-bind="$attrs" />
        <InputText v-if="type === 'text'" :id="name" class="w-full" v-bind="$attrs" />
        <InputNumber v-if="type === 'number'" :id="name" class="w-full" v-bind="$attrs" />

        <InputIcon v-if="icon" :class="{ 'textarea-icon': type === 'textarea' }">
          <span :class="icon" class="rx-icon cursor-pointer" @click="$emit('iconClick')" />
        </InputIcon>
      </IconField>
      <Password v-else :id="name" class="w-full" :feedback="false" toggle-mask v-bind="$attrs" />
      <small v-if="$attrs.invalid" class="rx-input-help">{{ $attrs.placeholder }}</small>
      <small v-if="$attrs.help" class="rx-input-help">{{ $attrs.help }}</small>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-password-input) {
  width: 100%;
}

:deep(.p-iconfield) {
  .p-textarea:not(:last-child) {
    padding-right: calc((var(--p-form-field-padding-x) * 2) + var(--p-icon-size));
  }
}

.rx-input {
  display: flex;
  flex-direction: column;

  &.rx-label-left {
    flex-direction: row;
  }

  &-help {
    display: flex;
    margin-top: var(--spacing-sm, 4px);
    gap: var(--spacing-sm, 4px);
    color: var(--p-red-400, #f87171);
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.textarea-icon {
  top: 1.2rem;
}
</style>
