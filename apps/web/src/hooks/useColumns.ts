interface ColumnCache {
  [key: string]: { visible: string; sort: string }
}

interface Columns {
  key: string
  data: any[]
}

function useColumns(data: Columns) {
  const { key, data: list } = data

  const cache = (localStorage.getItem(key)?.split(',') || []).reduce(
    (map: ColumnCache, cur: string) => {
      const [key, visible, sort] = cur.split('_')
      map[key] = {
        visible: visible ? JSON.parse(visible) : undefined,
        sort
      }
      return map
    },
    {}
  )

  const _list = ref(
    list
      .map((item, index) => {
        const _visible = cache[item.key]?.visible ?? true
        const _sort = cache[item.key]?.sort ?? index
        return {
          ...item,
          _visible,
          _sort
        }
      })
      .slice()
      .sort((a, b) => a._sort - b._sort)
  )

  onUnmounted(() => {
    const _cache = _list.value
      .map((item, index) => `${item.key}_${item._visible}_${index}`)
      .join(',')
    localStorage.setItem(key, _cache)
  })

  return [_list]
}

export default useColumns
