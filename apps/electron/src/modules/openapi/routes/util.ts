import { isPlainObject } from 'es-toolkit'

/** 对数据的 key 按照指定的映射关系进行重新排序 */
export function mappingKeys(mapping: Record<string, any>, data: Record<string, any> | Record<string, any>[]) {
  if (Array.isArray(data)) {
    return data.map(item => mappingKeys(mapping, item))
  }

  const result: Record<string, any> = {}
  for (const key in mapping) {
    if (mapping[key] === undefined) {
      continue
    }

    if (isPlainObject(mapping[key]) && isPlainObject(data[key])) {
      result[key] = mappingKeys(mapping[key], data[key])
    }
    else {
      result[key] = data[key]
    }
  }

  return result
}
