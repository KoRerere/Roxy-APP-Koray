import type { RxFormEmits } from '/@/components/rx-form/src/form'
import type { FormSchema } from '/@/components/rx-form/src/types/form'
import { isFunction, isPlainObject, isString, merge, uniqBy } from 'es-toolkit'
import { useFormContext } from '/@/components/rx-form/src/hooks/useFormContext'

interface UseFormMethodsParams {
  emit: RxFormEmits
}

export function useFormMethods({ emit }: UseFormMethodsParams) {
  const { formProps, formState } = useFormContext()
  const { formModel, validationSchema, errors, innerFormSchemas, originComponentPropsFnMap, defaultFormValues } = formState

  async function resetSchema(data: Partial<FormSchema> | Partial<FormSchema>[]) {
    let updateData: Partial<FormSchema>[] = []
    if (isPlainObject(data)) {
      updateData.push(data as FormSchema)
    }
    if (Array.isArray(data)) {
      updateData = [...data]
    }
    innerFormSchemas.value = updateData as FormSchema[]
  }

  /**
   * @description: 插入到指定 field 后面，如果没传指定 field，则插入到最后
   */
  async function appendSchemaByField(schemaItem: FormSchema, prefixField?: string) {
    const index = innerFormSchemas.value.findIndex(schema => schema.field === prefixField)

    if (!prefixField || index === -1) {
      innerFormSchemas.value.push(schemaItem)
    }
    else {
      innerFormSchemas.value.splice(index + 1, 0, schemaItem)
    }
  }

  /** 插入到指定 field 前面，如果没传指定 field，则插入到最前面 */
  function insertBeforeSchemaByField(schemaItem: FormSchema, prefixField?: string) {
    const index = innerFormSchemas.value.findIndex(schema => schema.field === prefixField)

    if (!prefixField || index === -1) {
      innerFormSchemas.value.unshift(schemaItem)
    }
    else {
      innerFormSchemas.value.splice(index, 0, schemaItem)
    }
  }

  /**
   * @description: 根据 field 删除 Schema
   */
  async function removeSchemaByField(fields: string | string[]): Promise<void> {
    if (!fields) {
      return
    }

    const fieldList: string[] = isString(fields) ? [fields] : fields

    for (const field of fieldList) {
      if (isString(field)) {
        const index = innerFormSchemas.value.findIndex(schema => schema.field === field)
        if (index !== -1) {
          Reflect.deleteProperty(formModel.value, field)
          innerFormSchemas.value.splice(index, 1)
        }
      }
    }
  }

  /**
   * @description: 根据 field 查找 Schema
   */
  function getSchemaByField(field: string): FormSchema | undefined {
    return innerFormSchemas.value.find(schema => field === schema.field)
  }

  /**
   * @description  更新formItemSchema
   */
  const updateSchema = (data: Partial<FormSchema> | Partial<FormSchema>[]) => {
    const updateData = ([] as Partial<FormSchema>[]).concat(data)

    const hasField = updateData.every(
      item => item.component === 'Divider' || (Reflect.has(item, 'field') && item.field),
    )

    if (!hasField) {
      console.error(
        'All children of the form Schema array that need to be updated must contain the `field` field',
      )
      return
    }
    const schemas: FormSchema[] = []
    const updatedSchemas: FormSchema[] = []

    innerFormSchemas.value.forEach((val) => {
      const updateItem = updateData.find(n => val.field === n.field)
      if (updateItem) {
        const compProps = updateItem.componentProps
        const newSchema = merge(val, updateItem)

        if (originComponentPropsFnMap.has(val.field)) {
          const originCompPropsFn = originComponentPropsFnMap.get(val.field)!

          newSchema.componentProps = (opt) => {
            return {
              ...originCompPropsFn(opt),
              ...(isFunction(compProps) ? compProps(opt) : compProps),
            }
          }
        }

        updatedSchemas.push(newSchema)
        schemas.push(newSchema)
      }
      else {
        schemas.push(val)
      }
    })

    innerFormSchemas.value = uniqBy(schemas, item => item.field)
  }

  /** 设置字段的值 */
  function setFieldsValue(obj: Recordable) {
    Object.assign(formModel.value, obj)
    console.log('formModel', formModel.value)
  }

  /** 重置表单 */
  function resetFields() {
    Object.keys(formModel.value).forEach((key) => {
      formModel.value[key] = defaultFormValues.value[key] ?? ''
    })
    setTimeout(() => {
      Object.keys(errors.value).forEach((key) => {
        errors.value[key] = ''
      })
    })
    emit('reset')
  }

  /**
   * 提交表单并验证所有字段
   */
  function handleSubmit(e?: Event) {
    e?.preventDefault()
    const result = validationSchema.value.safeParse(formModel.value)
    console.log('result', result)
    // 清除所有字段的错误信息
    Object.keys(errors.value).forEach((key) => {
      errors.value[key] = ''
    })

    // 表单验证失败，更新错误信息
    if (!result.success) {
      // 遍历错误并更新错误信息
      result.error.errors.forEach((error) => {
        const field = error.path[0]
        errors.value[field] = error.message
      })
      return Promise.reject(errors.value)
    }
    else {
      emit('submit', formModel.value)
      return Promise.resolve(formModel.value)
    }
  }

  return {
    setFieldsValue,
    resetFields,
    handleSubmit,
    resetSchema,
    appendSchemaByField,
    insertBeforeSchemaByField,
    removeSchemaByField,
    getSchemaByField,
    updateSchema,
  }
}
