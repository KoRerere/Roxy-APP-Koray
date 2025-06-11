<script setup lang="tsx">
import type { FormSubmitEvent } from '@primevue/forms';
import { z, type ZodFirstPartySchemaTypes } from 'zod';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { isFunction } from 'es-toolkit';
import { $t } from '/@/locales';
import { genFormContext } from './useContext';
import mInputLabel from './m-input-label.vue'
import mInputText from './m-input-text.vue'
import mInputNumber from './m-input-number.vue'
import mInputPassword from './m-input-password.vue'
import mInputTextarea from './m-input-textarea.vue'
import mInputSelect from './m-input-select.vue'
import mInputMultiSelect from './m-input-multi-select.vue'
import mInputDatePicker from './m-input-date-picker.vue'
import mCustom from './m-custom.vue';

const INPUT_TYPE_MAP = {
  text: mInputText,
  number: mInputNumber,
  password: mInputPassword,
  textarea: mInputTextarea,
  select: mInputSelect,
  mselect: mInputMultiSelect,
  date: mInputDatePicker,
  // 'checkbox': 'checkbox',
  // 'radio': 'radio',
  // 'switch': 'switch',
} as Record<string, Component>

interface Input {
  name: string
  label?: string
  tooltip?: string
  type?: keyof typeof INPUT_TYPE_MAP
  props?: Record<string, any>
  render?: (props: any) => any
  resolver?: (zod: typeof z) => ZodFirstPartySchemaTypes
  [key: string]: any
}

const { id = Date.now().toString(32), inputs = [] } = defineProps<{
  id?: string
  inputs: Input[]
}>()

const _inputs = ref(inputs)

const emit = defineEmits<{
  (e: 'submit', values: Record<string, any>): void
}>()

genFormContext({
  setValues: (values: Record<string, any>) => {
    formRef.value?.setValues(values)
  },
  setFieldValue: (name: string, value: any) => {
    formRef.value?.setFieldValue(name, value)
  },
  getFieldState: (name: string) => {
    return formRef.value?.getFieldState(name)
  }
})

const formRef = useTemplateRef<any>('wcisform')

function genFormFieldProps(input: Input) {
  const { name, label, required, props, resolver } = input
  return {
    name,
    initialValue: initialValue(input),
    resolver: isFunction(resolver)
      ? zodResolver(resolver(z))
      : required
        ? zodResolver(z.any().refine(val => !!val, $t('"{name}" 是必填项', { name: label || props?.placeholder })))
        : undefined,
  }
}

function initialValue(input: Input) {
  if (input.value) return input.value

  switch (input.type) {
    case 'number':
      return 0
    default:
      return ''
  }
}

function onFormSubmit(event: FormSubmitEvent) {
  if (event.valid) {
    const values = Object.fromEntries(Object.entries(event.states).map(([key, value]) => [key, value.value]))
    emit('submit', values)
  }
}

defineExpose({
  instance: formRef,
  setInputsProps: (map: Record<string, any>) => {
    _inputs.value = _inputs.value.map(item => {
      if (map.hasOwnProperty(item.name)) {
        item.props = { ...item.props, ...map[item.name] }
      }
      return item
    })
  },
  getFieldState: (name: string) => {
    return formRef.value?.getFieldState(name)
  },
  setValues: (values: Record<string, any>) => {
    formRef.value?.setValues(values)
  },
  reset: () => {
    formRef.value?.reset()
  },
  submit: () => {
    formRef.value?.submit()
  }
})
</script>

<template>
  <Form ref="wcisform" :id="id" @submit="onFormSubmit" class="flex flex-col gap-6 w-full">
    <FormField class="flex flex-col gap-1" v-slot="$field" v-for="input in _inputs" :key="input.name" v-bind="genFormFieldProps(input)">
      <mInputLabel v-if="input.label" :label="input.label" :tooltip="input.tooltip"></mInputLabel>
      <mCustom v-if="input.render" :field="$field" :input="input"></mCustom>
      <component v-else :is="INPUT_TYPE_MAP[input.type!]" v-bind="input.props" />
      <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">{{ $field.error?.message }}</Message>
    </FormField>
  </Form>
</template>

<style scoped></style>
