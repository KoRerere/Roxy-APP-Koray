<script setup lang="ts">
import MInputLabel from './m-input-label.vue'
import MInputText from './m-input-text.vue'
import MInputNumber from './m-input-number.vue'
import MInputPassword from './m-input-password.vue'
import MInputTextarea from './m-input-textarea.vue'
import MInputSelect from './m-input-select.vue'
import MInputMultiSelect from './m-input-multi-select.vue'
import MInputDatePicker from './m-input-date-picker.vue'
import MInputRadio from './m-input-radio.vue'
import MCustom from './m-custom.vue';
import { createReusableTemplate } from '@vueuse/core';
import type { Input, InputType } from './type';

defineOptions({ inheritAttrs: false })

const { input } = defineProps<{
  input: Input
}>()

const [DefineTemplate, ReuseTemplate] = createReusableTemplate({
  inheritAttrs: false,
})

const INPUT_TYPE_MAP = {
  text: MInputText,
  number: MInputNumber,
  password: MInputPassword,
  textarea: MInputTextarea,
  select: MInputSelect,
  mselect: MInputMultiSelect,
  date: MInputDatePicker,
  radio: MInputRadio,
  // 'checkbox': 'checkbox',
  // 'switch': 'switch',
} as Partial<Record<InputType, Component>>

// todo! 暂时只有 radio 组件需要 name 后续优化此处
const name = input.type === 'radio' ? input.name : undefined
</script>

<template>
  <DefineTemplate v-slot="{ input: ipt, class: fieldClass }">
    <FormField class="flex flex-col gap-1" :class="fieldClass" v-slot="$field" :name="ipt.name">
      <MInputLabel v-if="ipt.label" :label="ipt.label" :tooltip="ipt.tooltip"></MInputLabel>
      <div class="inline-flex">
        <MCustom v-if="ipt.render" :field="$field" :input="ipt"></MCustom>
        <component v-else :is="INPUT_TYPE_MAP[ipt.type] || MInputText" v-bind="ipt.props" :name="name" />
      </div>
      <component v-if="ipt.afterRender" :is="ipt.afterRender" :field="$field" :input="ipt"></component>
      <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">{{ $field.error?.message }}</Message>
    </FormField>
  </DefineTemplate>

  <RxDivider v-if="input.separator" line-only></RxDivider>

  <InputGroup v-else-if="input.type === 'group'">
    <InputGroupAddon class="!pa-0" :class="child.groupClass" v-for="child in input.items" :key="child.name">
      <ReuseTemplate class="w-full" :input="child" />
    </InputGroupAddon>
  </InputGroup>

  <ReuseTemplate v-else :input="input" />
</template>

<style scoped></style>
