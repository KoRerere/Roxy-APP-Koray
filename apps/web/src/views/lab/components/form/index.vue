<script setup lang="tsx">
import FormItem from './item.vue';
import { z } from 'zod';
import { $t } from '/@/locales';
import { genFormContext } from './useContext';
import { isFunction } from 'es-toolkit';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import type { FormInstance, FormSubmitEvent } from '@primevue/forms';
import type { Input } from './type';

const { id = Date.now().toString(32), inputs = [], position = 'top', labelProps } = defineProps<{
  id?: string
  position?: 'top' | 'left'
  labelProps?: Record<string, any>
  inputs: Input[]
}>()

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

const initialForm = inputs.reduce((acc, input) => {
  const { name, label, props, required, resolver } = input
  acc.values.push([name, initialFieldValue(input)])

  if (isFunction(resolver)) {
    acc.resolver.push([name, resolver(z)])
  } else if (required) {
    acc.resolver.push([name, z.any().refine(val => !!val, $t('"{name}" 是必填项', { name: label || props?.placeholder }))])
  }

  return acc
}, { values: [], resolver: [] } as { values: [string, any][], resolver: [string, any][] })

const formRef = useTemplateRef<FormInstance>('tsform')
const _inputs = ref(inputs)
const initialValues = reactive(Object.fromEntries(initialForm.values))
const resolver = zodResolver(z.object(Object.fromEntries(initialForm.resolver)))

function initialFieldValue(input: Input) {
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
  getValues: () => {
    return Object.fromEntries(Object.entries(formRef.value?.states!).map(([key, value]) => [key, value.value]))
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
  <Form ref="tsform" :id="id" :initialValues="initialValues" :resolver="resolver" @submit="onFormSubmit" class="flex flex-col gap-4 self-stretch">
    <slot name="default" :inputs="_inputs">
      <template v-for="input in _inputs" :key="input.name">
        <FormItem :input="input"></FormItem>
      </template>
    </slot>
  </Form>
</template>

<style scoped></style>
