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

const formRef = useTemplateRef<FormInstance>('tsform')
const _inputs = ref(inputs)
const initialForm = formatForm(inputs)
const initialValues = reactive(Object.fromEntries(initialForm.values))
const resolver = zodResolver(z.object(Object.fromEntries(initialForm.resolver)))

function formatForm(inputs: Input[]) {
  return inputs.reduce((acc, input) => {
    const { name, label, props, items, required, resolver } = input

    if (items?.length) {
      const { resolver, values } = formatForm(items)
      acc.resolver.push(...resolver)
      acc.values.push(...values)
    } else if (name) {
      const _resolver = (isFunction(resolver) && resolver(z)) || (required && z.any().refine(val => !!val, $t('"{name}" 是必填项', { name: label || props?.placeholder })))
      _resolver && acc.resolver.push([name, _resolver])
      acc.values.push([name, initialFieldValue(input)])
    }

    return acc
  }, { resolver: [], values: [] } as { resolver: [string, any][], values: [string, any][] })
}

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

function setInputsProps(map: Record<string, any>, inputs: Input[]) {
  inputs.forEach(item => {
    if (item.items?.length) {
      setInputsProps(map, item.items)
    } else if (map.hasOwnProperty(item.name)) {
      const { value, ...props } = map[item.name]
      Reflect.set(item, 'props', { ...item.props, ...props })
      if (value) {
        Reflect.set(initialValues, item.name, value)
        formRef.value?.setFieldValue(item.name, value)
      }
    }
  })
}

defineExpose({
  instance: formRef,
  setInputsProps: (map: Record<string, any>) => {
    setInputsProps(map, _inputs.value)
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
