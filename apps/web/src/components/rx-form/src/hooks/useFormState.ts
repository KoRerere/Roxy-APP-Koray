import type { ComponentProps, RenderCallbackParams } from '/@/components/rx-form/src/types/form'
import type { RxFormEmits, RxFormProps } from '../form'
import { useVModel } from '@vueuse/core'
import { cloneDeep, isFunction } from 'es-toolkit'
import { z } from 'zod'

export interface useFormStateParams {
  props: RxFormProps
  emit: RxFormEmits
}

export type UseFormStateReturnType = ReturnType<typeof useFormState>

export function useFormState({ props, emit }: useFormStateParams) {
  /** 表单项数据 */
  const formModel = (props.modelValue ? useVModel(props, 'modelValue', emit, { defaultValue: { ...props.initialValues } }) : ref<Recordable>({ ...props.initialValues })) as Ref<Recordable>
  /** 将 formSchema 克隆一份，避免修改原有的 formSchema，后续修改 formSchema 必须调用内部的方法进行修改  */
  const innerFormSchemas = shallowRef(reactive(cloneDeep(props.schemas!)))
  /** 初始时的componentProps，用于updateSchema更新时不覆盖componentProps为函数时的值 */
  const originComponentPropsFnMap = new Map<
    string,
    (opt: RenderCallbackParams) => ComponentProps
  >()

  /** 表单默认数据, 用于 reset 时重置表单数据 */
  const defaultFormValues = computed(() => {
    const formItemDefaultValues = innerFormSchemas.value.reduce((acc, item) => {
      if (item.defaultValue) {
        acc[item.field] = item.defaultValue
      }
      return acc
    }, {} as Recordable)

    return {
      ...props.initialValues,
      ...formItemDefaultValues,
    }
  })
  /** 错误信息 */
  const errors = ref<Recordable>({})

  // 使用 Zod 定义验证规则
  const validationSchema = computed(() => {
    return z.object(props.schemas!.reduce((acc, item) => {
      if (item.rule) {
        acc[item.field] = item.rule.validator?.(z, formModel) ?? z.any()
      }
      return acc
    }, {} as Recordable))
  })

  watch(innerFormSchemas, (schemas) => {
    schemas?.forEach((item) => {
      if (!originComponentPropsFnMap.has(item.field) && isFunction(item.componentProps)) {
        originComponentPropsFnMap.set(item.field, item.componentProps)
      }
      formModel.value[item.field] ??= defaultFormValues.value[item.field] ?? ''
    })
  }, { immediate: true })

  return {
    formModel,
    defaultFormValues,
    validationSchema,
    errors,
    innerFormSchemas,
    originComponentPropsFnMap,
  }
}
