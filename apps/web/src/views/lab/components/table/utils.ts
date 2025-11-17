import { safeParseJSON } from '/@/utils'

interface ColumnCache {
  field: string
  _sort?: number
  _visible?: boolean
  _cache?: any
}

export function setDisplay<T extends ColumnCache>(displayKey: string | undefined, rawColumns: T[]): (T & ColumnCache)[] {
  if (!displayKey) return rawColumns

  const rawCache = safeParseJSON(localStorage.getItem(displayKey))
  const cacheMap = (Array.isArray(rawCache) ? rawCache : [])
    .reduce((map, [key, value]) => {
      map[key] = value
      return map
    }, {})

  return rawColumns.map((item, index) => {
    const cache = cacheMap[item.field]
    return {
      ...item,
      _sort: cache?.sort ?? item._sort ?? index,
      _visible: cache?.visible ?? item._visible ?? true,
      _cache: cache?.cache ?? item._cache,
    }
  }).toSorted((a, b) => a._sort - b._sort)
}
