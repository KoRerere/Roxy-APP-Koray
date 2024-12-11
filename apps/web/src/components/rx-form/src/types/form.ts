import type { Component, ComputedRef, CSSProperties, Ref, VNode, WatchOptions } from 'vue'
import type { z, ZodFirstPartySchemaTypes } from 'zod'
import type { ComponentMapProps, ComponentType } from '../componentMap'

export interface Rule {
  trigger?: 'blur' | 'change' | 'submit'
  validator?: (zod: typeof z, formModel: Ref<Recordable>) => ZodFirstPartySchemaTypes
}

export interface RenderCallbackParams<
  T extends object = Recordable,
  P extends ComponentProps = ComponentProps,
> {
  schema: FormSchema<T> & {
    componentProps: P
  }
  /** 响应式的表单数据对象 */
  formModel: Objectable<T>
  field: GetFieldKeys<T>
  /** 非响应式的表单数据对象(最终表单要提交的数据) */
  // values: any
  /** 动态表单实例 */
  // formInstance: SchemaFormType;
  /** 作用域插槽数据 */
  slotData?: Recordable
}

/** 获取所有字段名 */
export type GetFieldKeys<T> = Exclude<keyof T, symbol | number>

/** 组件异步请求配置 */
type RequestConfig =
  | PromiseFn<RenderCallbackParams, any>
  | {
    /** 指定监听的字段名, 当该字段值发生变化时会调用 callback */
    watchFields: string[]
    callback: PromiseFn<RenderCallbackParams, any>
    options?: WatchOptions
    /** debounce 请求防抖 */
    wait?: number
  }

/** 组件属性 */
export type ComponentProps<T extends ComponentType = ComponentType> = Omit<ComponentMapProps[T], 'placeholder'> & {
  /** 组件异步请求数据 */
  request?: RequestConfig
  /** 组件异步请求数据结果 */
  requestResult?: any
  style?: CSSProperties
  /** 手动指定v-model绑定的key */
  vModelKey?: string
  placeholder: string | (() => any)
  [key: string]: any
}

/** 自定义VNode渲染器 */
export type CustomRenderFn<T extends object = Recordable> = (
  renderCallbackParams: RenderCallbackParams<T>,
) => VNode | VNode[] | string

type ComponentSchema<T extends object = Recordable> =
  | {
    [K in ComponentType]: {
      /** 表单项对应的组件，eg: Input */
      component: K
      /** 表单组件属性 */
      componentProps?:
      | ComponentProps<K>
      | ((opt: RenderCallbackParams<T, ComponentProps<K>>) => ComponentProps<K>)
    };
  }[ComponentType]
  | {
    component: CustomRenderFn<T> | ((opt: RenderCallbackParams<T>) => Component)
    componentProps?: ComponentProps | ((opt: RenderCallbackParams<T>) => ComponentProps)
  }

export type FormSchema<T extends object = Recordable> = ComponentSchema<T> & {
  /** 字段名 */
  field: string
  label?: string | (() => any)
  vIf?: (opt: RenderCallbackParams<T>) => boolean
  /** 表单项校验规则 */
  rule?: Rule
  /** 默认值 */
  defaultValue?: any
  /** 表单组件slots，例如 Select 的 optiongroup slot 可以写成：{ optiongroup: () => VNode } */
  componentSlots?:
  | ((renderCallbackParams: RenderCallbackParams<T>) => Recordable<CustomRenderFn<T>>)
  | Recordable<CustomRenderFn<T>>
  | ReturnType<CustomRenderFn>
}
