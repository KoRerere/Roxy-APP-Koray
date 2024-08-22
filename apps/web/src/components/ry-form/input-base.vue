<script setup lang="ts">
import inputLabel from './input-label.vue'

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
  // tooltip: String,
  icon: String,
  leftIcon: String,
  iconClick: {
    type: Function,
    default: () => () => { },
  },
})

defineEmits(['iconClick'])

const xxx = useAttrs()
if (xxx.mark) {
  console.log('🚀 ~ xxx:', xxx)
}
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot>
      <slot name="label">
        <input-label class="input-label" :name="name" v-bind="$attrs" />
      </slot>
      <slot name="input" :input="$attrs">
        <IconField v-if="type !== 'password'" class="w-full">
          <InputIcon v-if="leftIcon">
            <span :class="leftIcon" class="cursor-pointer" @click="$emit('iconClick')" />
          </InputIcon>
          <Textarea v-if="type === 'textarea'" :id="name" class="w-full" rows="5" cols="30" auto-resize
            v-bind="$attrs" />
          <InputText v-if="type === 'text'" :id="name" class="w-full" v-bind="$attrs" />
          <InputNumber v-if="type === 'number'" :id="name" class="w-full" v-bind="$attrs" />
          <InputIcon v-if="icon" :class="{ 'textarea-icon': type === 'textarea' }">
            <span :class="icon" class="cursor-pointer" @click="$emit('iconClick')" />
          </InputIcon>
        </IconField>
        <Password v-else :id="name" class="w-full" :feedback="false" toggle-mask v-bind="$attrs" />
      </slot>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-password-input) {
  width: 100%;
}

.rx-input {
  display: flex;
  flex-direction: column;

  &.rx-label-left {
    flex-direction: row;
  }
}

.textarea-icon {
  top: 1.2rem;
}
</style>
