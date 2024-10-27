export interface Operation {
  name?: string
  label?: string
  power?: boolean
  quick?: boolean
  multiple?: boolean
  separator?: boolean
  [key: string]: any
}

export function operationPower(operation: Operation[]) {
  return operation.filter(op => op.power !== false)
}
