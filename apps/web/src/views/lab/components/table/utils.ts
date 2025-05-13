import { safeParseJSON } from '/@/utils'

export function setDisplay(displayKey: string, rawColumns: Record<string, any>[]) {
  const rawCache = safeParseJSON(localStorage.getItem(displayKey))
  const cacheMap = (Array.isArray(rawCache) ? rawCache : [])
    .reduce((map: Record<string, any>, [key, value]: [string, any]) => {
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
      _displayed: true
    }
  }).toSorted((a, b) => a._sort - b._sort)
}