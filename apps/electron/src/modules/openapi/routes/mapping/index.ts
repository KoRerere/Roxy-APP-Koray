import { isPlainObject } from 'es-toolkit'

export * from './account'
export * from './browserList'


export function mapping2Object(row: Record<string, any>, mapping: Record<string, any>) {
  return Object.entries(mapping).reduce((acc, [key, value]) => {
    if (row[key] && isPlainObject(value)) {
      acc[key] = mapping2Object(isPlainObject(row[key]) ? row[key] : row, value)
    } else if (row[key] && Array.isArray(value) && isPlainObject(value[0])) {
      acc[key] = mapping2List(row[key], value[0])
    } else {
      acc[key] = row[key]
    }
    return acc
  }, {})
}

export function mapping2List(rows: Record<string, any>[], mapping: Record<string, any>) {
  return rows.map((row) => mapping2Object(row, mapping))
}
