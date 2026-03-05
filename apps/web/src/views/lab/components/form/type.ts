import type { z, ZodFirstPartySchemaTypes } from 'zod'

interface BaseInput {
  label?: string
  tooltip?: string
  props?: Record<string, any>
  resolver?: (zod: typeof z) => ZodFirstPartySchemaTypes
  [key: string]: any
}

type SeparatorInput = BaseInput & {
  separator: boolean
}

type GroupInput = BaseInput & {
  type: InputType
  items: Input[]
}

type CustomInput = BaseInput & {
  render: (props: any) => any
}

type NormalInput = BaseInput & {
  type: InputType
  name: string
}

export type InputType = 'group' | 'text' | 'number' | 'password' | 'textarea' | 'select' | 'mselect' | 'date' | (string & {})
export type Input = SeparatorInput | GroupInput | CustomInput | NormalInput
