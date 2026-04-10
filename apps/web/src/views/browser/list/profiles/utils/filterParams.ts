/** 从自定义筛选菜单构建保存/跳转用的 filter_condition 对象 */
export function buildCustomFilterParamsFromMenu(filtersMenu: { name: string, value: unknown }[] | undefined | null): Record<string, unknown> {
  if (!filtersMenu?.length)
    return {}
  return filtersMenu.reduce((acc, cur) => {
    if (cur.value)
      acc[cur.name] = toRaw(cur.value)
    return acc
  }, {} as Record<string, unknown>)
}
