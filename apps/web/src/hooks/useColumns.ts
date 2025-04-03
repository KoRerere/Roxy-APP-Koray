import { deepClone, safeParseJSON } from '/@/utils'

interface Columns {
  key: string
  data: any[]
}

interface Options {
  inserts?: [number, any][]
  filters?: string[]
}

export function useColumns({ key, data }: Columns, filterColumnKeys?: string[]) {
  const rawCache = safeParseJSON(localStorage.getItem(key))
  const cache = (Array.isArray(rawCache) ? rawCache : [])
    .reduce((cacheMap: Record<string, any>, data: [string, Record<string, any>]) => {
      const [columnKey, cache] = data
      cacheMap[columnKey] = cache
      return cacheMap
    }, {})

  const _list = ref(
    data
      .filter(item => !filterColumnKeys || !filterColumnKeys.includes(item.key))
      .map((item, index) => {
        const { sort, visible, caches } = cache[item.key] ?? {}

        const _sort = sort ?? item._sort ?? index
        const _visible = visible ?? item._visible ?? true
        const _caches = caches ?? item._caches ?? undefined

        const column = { ...item, _sort, _visible }

        if (_caches) {
          column._caches = _caches
        }

        return column
      })
      .toSorted((a, b) => a._sort - b._sort)
  )

  onUnmounted(() => {
    const _cache = _list.value.map((item, index) => [item.key, { visible: item._visible, sort: index, caches: item._caches }])
    localStorage.setItem(key, JSON.stringify(_cache))
  })

  return [_list]
}

// 表头存储数据格式
// {
//   "name": "name",
//   "sort": 1,
//   "status": 1
// }

export function setColumns(columns: any, options?: Options) {
  const _columns = deepClone(columns)
  const { filters, inserts }: Options = Object.assign({ filters: [], inserts: [] }, options)
  if (Array.isArray(inserts)) {
    inserts.forEach(([index, item]) => {
      _columns.splice(index, 0, item)
    })
  }
  return _columns.filter((item: any) => !filters || !filters.includes(item.key))
}

export default useColumns
