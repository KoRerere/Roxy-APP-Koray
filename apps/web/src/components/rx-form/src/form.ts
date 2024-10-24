import type { EmitFn, ExtractPropTypes } from 'vue'
import { isPlainObject } from 'es-toolkit'
import type { FormSchema } from './types/form'

export const rxFormProps = {
  modelValue: {
    type: Object as PropType<Recordable>,
  },
  schemas: {
    type: Object as PropType<FormSchema[]>,
    required: true,
  },
  initialValues: {
    type: Object as PropType<Recordable>,
    default: () => ({}),
  },
  layout: {
    type: String as PropType<'horizontal' | 'vertical' | 'inline'>,
    default: 'horizontal',
  },
  /** 是否显示冒号 */
  colon: {
    type: Boolean as PropType<boolean>,
    default: true,
  },
  labelWidth: {
    type: String as PropType<string>,
    default: '110px',
  },
  labelAlign: {
    type: String as PropType<'left' | 'right'>,
    default: 'right',
  },
  /** 是否显示底部 */
  footer: {
    type: Boolean as PropType<boolean>,
    default: true,
  },
}

export const rxFormEmits = {
  'update:modelValue': (val: Recordable) => Boolean(val),
  'reset': () => true,
  'submit': (formModel: Recordable) => isPlainObject(formModel),
}

export type RxFormEmits = EmitFn<typeof rxFormEmits>
export type RxFormProps = ExtractPropTypes<typeof rxFormProps>
