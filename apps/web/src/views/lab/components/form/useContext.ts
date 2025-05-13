import { injectLocal, provideLocal } from '@vueuse/core'

interface DynamicFormType {
  setValues: (values: Record<string, any>) => void
  setFieldValue: (name: string, value: any) => void
  getFieldState: (name: string) => any
}

const key = Symbol('wcis_form')

export function genFormContext(instance: DynamicFormType) {
  provideLocal(key, instance)
}

export function useFormContext() {
  return injectLocal(key) as DynamicFormType
}
