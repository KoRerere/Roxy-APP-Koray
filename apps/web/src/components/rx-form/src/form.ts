import type { ExtractPropTypes } from 'vue'
import type { FormSchema } from './types/form'
import { isPlainObject } from 'es-toolkit'

export const formProps = {
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

export const formEmits = {
  reset: () => true,
  submit: (formModel: Recordable) => isPlainObject(formModel),
}

export type FormProps = ExtractPropTypes<typeof formProps>
