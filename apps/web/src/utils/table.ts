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

export function setRowsLoading(row: any, operateName: string, fn: (row: any) => Promise<any>) {
  (row.loadingOperationMap || (row.loadingOperationMap = {}))[operateName] = true
  return fn(row).then((data: any) => {
    row.loadingOperationMap[operateName] = false
    return data
  })
}

export function setOperationLoading(row: any, operateName: string, value: boolean) {
  (row.loadingOperationMap || (row.loadingOperationMap = {}))[operateName] = value
}
