export interface Operation {
  name?: string
  label?: string
  power?: boolean
  quick?: boolean
  multiple?: boolean
  separator?: boolean
  items?: Operation[]
  [key: string]: any
}

export function operationPower(operation: Operation[]) {
  return operation.reduce((acc, item) => {
    if (item.power === false)
      return acc

    if (item.items && Array.isArray(item.items)) {
      item.items = operationPower(item.items)
    }
    acc.push(item)
    return acc
  }, [] as Operation[])
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
