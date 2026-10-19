import type { ActionsItem } from './type'

/** 没权限的操作项直接不存在，和菜单里的 visible 无关 */
export function hasActionPower(item: ActionsItem) {
  if (typeof item.power === 'function') {
    return item.power() !== false
  }
  return item.power !== false
}

/** PrimeVue 的 visible：只决定菜单里显不显示 */
export function isMenuItemVisible(item: ActionsItem) {
  if (typeof item.visible === 'function') {
    return item.visible() !== false
  }
  return item.visible !== false
}

/** 按权限生成一份新列表，不改调用方传入的原数组 */
export function prepareActions(items: ActionsItem[]): ActionsItem[] {
  const next = items.flatMap((item) => {
    if (!hasActionPower(item)) {
      return []
    }
    if (!item.items?.length) {
      return [item]
    }
    const children = prepareActions(item.items)
    if (!children.length && !item.command) {
      return []
    }
    return [{ ...item, items: children }]
  })
  return tidySeparators(next)
}

/** 没权限的项拿掉之后，不留首尾和连续分隔线 */
function tidySeparators(items: ActionsItem[]) {
  const next: ActionsItem[] = []
  for (const item of items) {
    if (item.separator && (!next.length || next[next.length - 1]?.separator)) {
      continue
    }
    next.push(item)
  }
  while (next.at(-1)?.separator) {
    next.pop()
  }
  return next
}
