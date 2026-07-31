import { computed, reactive, ref } from 'vue'

export type DomSpotlightTarget = string | (() => HTMLElement | null)

const active = ref(false)
const rect = reactive({
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  borderRadius: '0px',
})

let teardown: (() => void) | undefined

/** 单例：供全局聚光灯层绑定样式 */
export const domSpotlightRingStyle = computed(() => ({
  top: `${rect.top}px`,
  left: `${rect.left}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
  borderRadius: rect.borderRadius,
}))

export const domSpotlightActive = active

function resolveElement(target: DomSpotlightTarget): HTMLElement | null {
  if (typeof target === 'function')
    return target()
  return document.querySelector(target) as HTMLElement | null
}

function syncFromElement(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  rect.top = r.top
  rect.left = r.left
  rect.width = r.width
  rect.height = r.height
  rect.borderRadius = getComputedStyle(el).borderRadius || '0px'
}

function getScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = []
  let node = el.parentElement

  while (node) {
    const { overflow, overflowX, overflowY } = getComputedStyle(node)
    if ([overflow, overflowX, overflowY].some(value => /auto|scroll|overlay/.test(value)))
      ancestors.push(node)
    node = node.parentElement
  }

  return ancestors
}

/** 显示聚光灯并跟随目标（滚动/缩放/尺寸变化） */
export function focusDomSpotlight(target: DomSpotlightTarget) {
  blurDomSpotlight()
  const el = resolveElement(target)
  if (!el)
    return

  active.value = true
  const handler = () => {
    const current = resolveElement(target)
    if (current)
      syncFromElement(current)
  }
  handler()
  window.addEventListener('scroll', handler, true)
  window.addEventListener('resize', handler)
  const ro = new ResizeObserver(handler)
  ro.observe(el)

  // 虚拟表格等内部滚动容器不冒泡到 window，需单独监听
  const scrollAncestors = getScrollableAncestors(el)
  scrollAncestors.forEach(node => node.addEventListener('scroll', handler, { passive: true }))

  teardown = () => {
    window.removeEventListener('scroll', handler, true)
    window.removeEventListener('resize', handler)
    ro.disconnect()
    scrollAncestors.forEach(node => node.removeEventListener('scroll', handler))
  }
}

export function blurDomSpotlight() {
  active.value = false
  teardown?.()
  teardown = undefined
}

export function useDomSpotlight() {
  return {
    active: domSpotlightActive,
    ringStyle: domSpotlightRingStyle,
    focus: focusDomSpotlight,
    blur: blurDomSpotlight,
  }
}
