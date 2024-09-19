import type { FormProps } from '../form'
import { z } from 'zod'

export interface useFormStateParams {
  props: FormProps
}

export type UseFormStateReturnType = ReturnType<typeof useFormState>

export function useFormState({ props }: useFormStateParams) {
  /** 表单项数据 */
  const formModel = ref({ ...props.initialValues })
  /** 表单默认数据, 用于 reset 时重置表单数据 */
  const defaultFormValues = ref({ ...props.initialValues })
  /** 错误信息 */
  const errors = ref<Recordable>({})

  // 使用 Zod 定义验证规则
  const validationSchema = computed(() => {
    return z.object(props.schemas!.reduce((acc, item) => {
      if (item.rule) {
        acc[item.field] = item.rule.validator?.(z) ?? z.any()
      }
      return acc
    }, {} as Recordable))
  })

  watch(() => props.schemas, (newVal) => {
    newVal?.forEach((item) => {
      formModel.value[item.field] ??= props.initialValues[item.field] ?? ''
    })
  }, { immediate: true })

  return {
    formModel,
    defaultFormValues,
    validationSchema,
    errors,
  }
}
