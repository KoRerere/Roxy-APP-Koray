import type { FormSchema } from './src/types/form'

export * from './src/form'
export { default as RxForm } from './src/rx-form.vue'

export * from './src/types/form'

export function defineFormSchema<T extends object = Recordable>(schema: FormSchema<T>[]) {
  return schema
}

// export default RxForm as typeof RxForm & {
//   readonly useForm: typeof useForm
// }
