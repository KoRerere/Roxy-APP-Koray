import type { FormSchema } from './src/types/form'

export { default as RxForm } from './src/form.vue'

export function defineFormSchema<T extends object = Recordable>(schema: FormSchema<T>[]) {
  return schema
}
