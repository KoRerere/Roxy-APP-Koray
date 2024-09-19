/**
 * Component list, register here to setting it in the form
 */

import type { Component, VNodeProps } from 'vue'

import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

const componentMap = {
  InputText,
  Password,
  RadioButton,
  Select,
  Textarea,
}

type ExtractPropTypes<T extends Component> = T extends new (...args: any) => any
  ? Writable<Omit<InstanceType<T>['$props'], keyof VNodeProps>>
  : never

type ComponentMapType = typeof componentMap

export type ComponentType = keyof ComponentMapType

export type ComponentMapProps = {
  [K in ComponentType]: ExtractPropTypes<ComponentMapType[K]>;
}

export type AllComponentProps = ComponentMapProps[ComponentType]

export { componentMap }
