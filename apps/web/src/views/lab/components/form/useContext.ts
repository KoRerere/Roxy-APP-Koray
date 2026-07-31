import { injectLocal, provideLocal } from '@vueuse/core'
import { toValue, type MaybeRef } from 'vue'

export type FormLabelPosition = 'top' | 'left'

interface DynamicFormType {
  setValues: (values: Record<string, any>) => void
  setFieldValue: (name: string, value: any) => void
  getFieldState: (name: string) => any
  position?: MaybeRef<FormLabelPosition>
  labelProps?: MaybeRef<Record<string, any> | undefined>
}

const key = Symbol('wcis_form')

export function genFormContext(instance: DynamicFormType) {
  provideLocal(key, instance)
}

export function useFormContext() {
  return injectLocal(key) as DynamicFormType
}

export function useFormLayout() {
  const ctx = useFormContext()

  return {
    position: computed(() => toValue(ctx?.position) ?? 'top'),
    labelProps: computed(() => toValue(ctx?.labelProps) ?? {}),
  }
}
