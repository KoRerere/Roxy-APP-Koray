import { isPlainObject } from 'es-toolkit'

export * from './account'
export * from './browserList'


export function mapping2Object(row: Record<string, any>, mapping: Record<string, any>, keepOriginals?: string[]) {
  return Object.entries(mapping).reduce((acc, [key, value]) => {
    if (keepOriginals && keepOriginals.includes(key)) {
      acc[key] = row[key]
      return acc
    }

    if (isPlainObject(value)) {
      const obj = row[key] && isPlainObject(row[key]) ? row[key] : row
      acc[key] = mapping2Object(obj, value)
    } else if (row[key] && Array.isArray(value) && isPlainObject(value[0])) {
      acc[key] = mapping2List(row[key], value[0])
    } else {
      acc[key] = row[key]
    }
    return acc
  }, {})
}

export function mapping2List(rows: Record<string, any>[], mapping: Record<string, any>, keepOriginals?: string[]) {
  return rows.map((row) => mapping2Object(row, mapping, keepOriginals))
}
