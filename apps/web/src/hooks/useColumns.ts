interface ColumnCache {
  [key: string]: { visible: string, sort: string }
}

interface Columns {
  key: string
  data: any[]
}

function useColumns(columns: Columns) {
  const { key, data } = columns

  const cache = (localStorage.getItem(key)?.split(',') || []).reduce(
    (settingMap, columnSetting: string) => {
      const [columnKey, visible, sort] = columnSetting.split('_')
      settingMap[columnKey] = {
        visible: visible ? JSON.parse(visible) : undefined,
        sort,
      }
      return settingMap
    },
    {} as ColumnCache,
  )

  const _list = ref(
    data
      .map((item, index) => {
        const _visible = cache[item.key]?.visible ?? true
        const _sort = cache[item.key]?.sort ?? index
        return {
          ...item,
          _visible,
          _sort,
        }
      })
      .slice()
      .sort((a, b) => a._sort - b._sort),
  )

  // onUnmounted(() => {
  //   const _cache = _list.value
  //     .map((item, index) => `${item.key}_${item._visible}_${index}`)
  //     .join(',')
  //   localStorage.setItem(key, _cache)
  // })

  return [_list]
}

// 表头存储数据格式
// {
//   "name": "name",
//   "sort": 1,
//   "status": 1
// }

export default useColumns
