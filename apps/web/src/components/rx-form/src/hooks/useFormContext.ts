import type { FormProps } from '../form'
import type { UseFormStateReturnType } from './useFormState'
import { injectLocal, provideLocal } from '@vueuse/core'

const key = Symbol('schema-form')

interface SchemaFormType {
  formState: UseFormStateReturnType
  formProps: FormProps
}

export async function createFormContext(instance: SchemaFormType) {
  provideLocal(key, instance)
}

export function useFormContext(formProps = {}) {
  return injectLocal(key, formProps) as SchemaFormType
}
