import { debounce } from 'es-toolkit'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { deepClone, safeParseJSON } from '/@/utils'
import { useUserStore } from '/@/stores/user'

interface Columns {
  key: string
  data: any[]
}

interface Options {
  inserts?: [number, any][]
  filters?: string[]
}

export function useColumns({ key, data }: Columns, filterColumnKeys?: string[]) {
  const { fetchUserInfo, updateUserConfig } = useUserStore()
  const [_, onlyErrorToast] = useResponseToast()
  const rawCache = safeParseJSON(localStorage.getItem(key))
  const cacheMap = (Array.isArray(rawCache) ? rawCache : [])
    .reduce((cacheMap: Record<string, any>, item: [string, Record<string, any>]) => {
      const [columnKey, value] = item
      cacheMap[columnKey] = value
      return cacheMap
    }, {})

  const _list = ref(genColumns())

  function genColumns() {
    return data
      .filter(item => !filterColumnKeys || !filterColumnKeys.includes(item.key))
      .map((item, index) => {
        const { sort, visible, cache } = cacheMap[item.key] ?? {}

        const _sort = sort ?? item._sort ?? index
        const _visible = visible ?? item._visible ?? true
        const _cache = cache ?? item._cache ?? undefined

        const column = { ...item, _sort, _visible }

        if (_cache) {
          column._cache = _cache
        }

        return column
      })
      .toSorted((a, b) => a._sort - b._sort)
  }

  function updateColumns(update: (columns: any[]) => void) {
    update(_list.value)
  }

  const updateRemarkDisplayStatus = debounce(async (remarkDisplayStatus: boolean) => {
    const { code, msg } = await API.base.userSetUserConfigCreate({
      remarkDisplayStatus,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    fetchUserInfo()
    updateUserConfig()
  }, 500)

  onUnmounted(() => {
    const _cache = _list.value.map((item, index) => [item.key, { visible: item._visible, sort: index, cache: item._cache }])
    localStorage.setItem(key, JSON.stringify(_cache))
  })

  return {
    columns: _list,
    updateColumns,
    updateRemarkDisplayStatus,
  }
}

// 表头存储数据格式
// {
//   "name": "name",
//   "sort": 1,
//   "status": 1
// }

export function setColumns(columns: any, options?: Options): any[] {
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
