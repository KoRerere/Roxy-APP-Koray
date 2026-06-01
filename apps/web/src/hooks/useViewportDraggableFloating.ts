import type { MaybeRefOrGetter, Ref } from 'vue'
import { nextTick, onBeforeUnmount, onMounted, ref, shallowReactive, toValue, watch } from 'vue'

/** fixed 浮动层在视口内的左上角坐标（单位 px） */
export interface ViewportPoint {
  left: number
  top: number
}

export interface ViewportDraggableFloatingOptions {
  /** 超过该距离的 pointer 位移才视为拖拽，避免误拖触发点击（默认 5） */
  dragThresholdPx?: number
  /** 确认为有效拖拽并在 pointer up 后调用（如写入 localStorage） */
  onDragCommit?: () => void
  /** 拖拽期间是否将 document.body.style.userSelect 设为 none（默认 true） */
  disableBodySelectionWhileDragging?: boolean
  /** 拖拽位移约束（默认自由移动） */
  dragConstraint?: ViewportDragConstraint
}

/** 浮动层拖拽约束 */
export type ViewportDragConstraint
  = | { mode: 'free' }
  /** 始终贴视口右缘，仅允许上下拖动 */
    | { mode: 'right-edge-vertical', rightGap?: number }

const DEFAULT_RIGHT_GAP_PX = 16

/**
 * 按约束修正坐标（hydrate / resize / 拖拽共用）
 */
export function applyDragConstraintToPoint(
  pos: ViewportPoint,
  width: number,
  height: number,
  constraint?: ViewportDragConstraint,
): ViewportPoint {
  if (!constraint || constraint.mode === 'free')
    return clampPointToViewport(pos.left, pos.top, width, height)

  if (constraint.mode === 'right-edge-vertical') {
    const rightGap = constraint.rightGap ?? DEFAULT_RIGHT_GAP_PX
    const left = window.innerWidth - rightGap - width
    return clampPointToViewport(left, pos.top, width, height)
  }

  return clampPointToViewport(pos.left, pos.top, width, height)
}

/**
 * 将矩形限制在浏览器视窗内（基于 window.innerWidth / innerHeight）
 */
export function clampPointToViewport(
  left: number,
  top: number,
  width: number,
  height: number,
): ViewportPoint {
  const maxL = Math.max(0, window.innerWidth - width)
  const maxT = Math.max(0, window.innerHeight - height)
  return {
    left: Math.round(Math.min(maxL, Math.max(0, left))),
    top: Math.round(Math.min(maxT, Math.max(0, top))),
  }
}

/** 读取 localStorage 等场景下的坐标校验 */
export function parseStoredViewportPoint(raw: unknown): ViewportPoint | null {
  if (!raw || typeof raw !== 'object')
    return null
  const left = Number((raw as ViewportPoint).left)
  const top = Number((raw as ViewportPoint).top)
  if (!Number.isFinite(left) || !Number.isFinite(top))
    return null
  return { left, top }
}

/**
 * 用元素当前占位尺寸裁剪坐标（无 DOM 时使用 fallback）
 */
export function clampElementPointToViewport(
  el: HTMLElement | null,
  pos: ViewportPoint,
  fallbackWidth = 40,
  fallbackHeight = 40,
  constraint?: ViewportDragConstraint,
): ViewportPoint {
  const w = Math.max(el?.offsetWidth ?? fallbackWidth, 1)
  const h = Math.max(el?.offsetHeight ?? fallbackHeight, 1)
  return applyDragConstraintToPoint(pos, w, h, constraint)
}

/** 直接将 ref 裁剪到当前视口（不改变元素绑定关系） */
export function clampViewportPointRefToElement(
  position: Ref<ViewportPoint>,
  elRef: Ref<HTMLElement | null>,
  fallbackWidth = 40,
  fallbackHeight = 40,
  constraint?: ViewportDragConstraint,
) {
  position.value = clampElementPointToViewport(
    elRef.value,
    position.value,
    fallbackWidth,
    fallbackHeight,
    constraint,
  )
}

const DEFAULT_DRAG_THRESHOLD_PX = 5

/**
 * 视口内拖拽的浮动层指针逻辑（常用于 fixed FAB）。
 * position 建议使用 ref，且与元素的 :style `{ left, top }`（单位 px）一致。
 */
export function useViewportDraggableFloating(
  position: Ref<ViewportPoint>,
  elRef: Ref<HTMLElement | null>,
  options?: ViewportDraggableFloatingOptions,
) {
  const threshold = options?.dragThresholdPx ?? DEFAULT_DRAG_THRESHOLD_PX
  const onDragCommit = options?.onDragCommit
  const disableBodySelection = options?.disableBodySelectionWhileDragging !== false
  const dragConstraint = options?.dragConstraint
  const verticalRail = dragConstraint?.mode === 'right-edge-vertical'

  const dragging = ref(false)
  /** 拖拽结束后紧随其后的 click 应被吞掉，避免误触发原按钮逻辑 */
  const suppressClickAfterDrag = ref(false)

  let dragStartClientX = 0
  let dragStartClientY = 0
  let dragStartLeft = 0
  let dragStartTop = 0
  let dragElW = 0
  let dragElH = 0
  let pointerMovedEnough = false

  function teardownListeners(el: HTMLElement, pointerId: number) {
    if (el.hasPointerCapture(pointerId))
      el.releasePointerCapture(pointerId)
    el.removeEventListener('pointermove', onPointerMove as EventListener)
    el.removeEventListener('pointerup', onPointerUp as EventListener)
    el.removeEventListener('pointercancel', onPointerUp as EventListener)
  }

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - dragStartClientX
    const dy = e.clientY - dragStartClientY
    if (verticalRail) {
      if (Math.abs(dy) >= threshold)
        pointerMovedEnough = true
    }
    else if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) {
      pointerMovedEnough = true
    }

    if (verticalRail) {
      position.value = applyDragConstraintToPoint(
        { left: dragStartLeft, top: dragStartTop + dy },
        dragElW,
        dragElH,
        dragConstraint,
      )
    }
    else {
      position.value = clampPointToViewport(
        dragStartLeft + dx,
        dragStartTop + dy,
        dragElW,
        dragElH,
      )
    }
    e.preventDefault()
  }

  function onPointerUp(e: PointerEvent) {
    const el = elRef.value
    if (el)
      teardownListeners(el, e.pointerId)
    dragging.value = false
    if (pointerMovedEnough) {
      suppressClickAfterDrag.value = true
      onDragCommit?.()
    }
    pointerMovedEnough = false
    if (disableBodySelection)
      document.body.style.userSelect = ''
  }

  function onPointerDown(e: PointerEvent) {
    const el = elRef.value
    if (!el || e.button !== 0)
      return
    pointerMovedEnough = false
    const rect = el.getBoundingClientRect()
    dragElW = rect.width
    dragElH = rect.height
    dragStartClientX = e.clientX
    dragStartClientY = e.clientY
    dragStartLeft = position.value.left
    dragStartTop = position.value.top
    dragging.value = true
    if (disableBodySelection)
      document.body.style.userSelect = 'none'
    el.setPointerCapture(e.pointerId)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
  }

  /** 拖拽刚结束紧随的「误触」click：吞掉本次并返回 true */
  function swallowFollowingClick(ev: MouseEvent): boolean {
    if (!suppressClickAfterDrag.value)
      return false
    ev.preventDefault()
    ev.stopPropagation()
    suppressClickAfterDrag.value = false
    return true
  }

  return {
    dragging,
    suppressClickAfterDrag,
    onPointerDown,
    swallowFollowingClick,
  }
}

/** 计算默认坐标时可读取同组其它层当前 ref（先 hydrate 的前序层已有值） */
export interface ViewportFloatingDefaultContext<K extends string = string> {
  positions: Record<K, Ref<ViewportPoint>>
}

/** 「成组」的固定悬浮层定义：共用一份 localStorage 与 resize/hydrate 流程 */
export interface ViewportFloatingGroupLayer<K extends string = string> {
  key: K
  elRef: Ref<HTMLElement | null>
  /** 默认坐标；与同组先后顺序有关，实现里可用 `ctx.positions` 读其它层的当前 ref（先 hydrate 的层已有值） */
  getDefaultPosition: (ctx: ViewportFloatingDefaultContext<K>) => ViewportPoint
  /**
   * 为 false（或 Getter 为假）时不做 hydrate/reclamp，用于 v-if 未挂载的 DOM
   * 默认 true
   */
  active?: MaybeRefOrGetter<boolean>
  /**
   * 为 false 时不把该层坐标写回缓存（常与 active 对齐；omit 等价于沿用 active）
   * 无权展示时又需保留库里旧坐标时，可设为 false（或独立 Getter）
   */
  persist?: MaybeRefOrGetter<boolean>
}

export interface ViewportFloatingGroupOptions<K extends string> {
  storageKey: string
  layers: readonly ViewportFloatingGroupLayer<K>[]
  /**
   * 首次 hydrate 结束前隐藏（opacity/事件），避免出现 (0,0) 一闪
   * @default true
   */
  hideUntilHydrated?: boolean
  /** 组内各层共用的拖拽约束 */
  dragConstraint?: ViewportDragConstraint
}

export interface ViewportFloatingGroupLayerApi {
  position: Ref<ViewportPoint>
  dragging: Ref<boolean>
  suppressClickAfterDrag: Ref<boolean>
  onPointerDown: (e: PointerEvent) => void
  swallowFollowingClick: (ev: MouseEvent) => boolean
}

/**
 * 多枚视口悬浮层：拖拽 + 互不覆盖的缓存字段 + hydrate / resize 裁剪一套样板。
 *
 * ```ts
 * const { layers, layoutReady, bootstrapLayout, hydrateKey } =
 *   useViewportDraggableFloatingGroup<'bubble' | 'more'>({
 *   storageKey: MY_KEY,
 *   layers: [
 *     { key: 'bubble', elRef: bubbleRef, getDefaultPosition: _ctx => ({ ... }) },
 *     { key: 'more', elRef: moreRef, getDefaultPosition: ({ positions }) => ({ ... }), active: showMore },
 *   ],
 * })
 *
 * watch(showMore, () => showMore.value && nextTick(() => hydrateKey('more')))
 * bootstrapLayout(() => {})
 * ```
 */
export function useViewportDraggableFloatingGroup<K extends string>(
  opts: ViewportFloatingGroupOptions<K>,
) {
  function resolveMaybeFlag(
    explicit: MaybeRefOrGetter<boolean> | undefined,
    fallback: MaybeRefOrGetter<boolean> | undefined,
  ): boolean {
    if (explicit !== undefined)
      return toValue(explicit)
    return toValue(fallback ?? true)
  }

  function isLayerActive(layer: ViewportFloatingGroupLayer<K>) {
    return resolveMaybeFlag(layer.active, true)
  }

  function shouldLayerPersist(layer: ViewportFloatingGroupLayer<K>) {
    return resolveMaybeFlag(layer.persist, layer.active)
  }

  const hideUntilHydrated = opts.hideUntilHydrated !== false
  const layoutReady = ref(!hideUntilHydrated)

  const positions = {} as Record<K, Ref<ViewportPoint>>
  for (const layer of opts.layers)
    positions[layer.key] = ref<ViewportPoint>({ left: 0, top: 0 })

  function readMergedRaw(): Partial<Record<K, unknown>> | null {
    try {
      const raw = localStorage.getItem(opts.storageKey)
      if (!raw)
        return null
      return JSON.parse(raw) as Partial<Record<K, unknown>>
    }
    catch {
      return null
    }
  }

  function persist() {
    try {
      const merged = readMergedRaw() ?? {}
      const payload = { ...merged } as Partial<Record<K, ViewportPoint>>

      for (const layer of opts.layers) {
        if (!shouldLayerPersist(layer))
          continue
        const k = layer.key
        payload[k] = { ...positions[k].value }
      }

      localStorage.setItem(opts.storageKey, JSON.stringify(payload))
    }
    catch {
      // ignore quota / serialization errors
    }
  }

  function hydrateKey(key: K) {
    const layer = opts.layers.find(l => l.key === key)!
    if (!isLayerActive(layer))
      return
    if (!layer.elRef.value)
      return

    const raw = parseStoredViewportPoint(readMergedRaw()?.[key])
    positions[key].value = clampElementPointToViewport(
      layer.elRef.value,
      raw ?? layer.getDefaultPosition({ positions }),
      40,
      40,
      opts.dragConstraint,
    )
  }

  function hydrateAll() {
    for (const layer of opts.layers)
      hydrateKey(layer.key)
  }

  /** 按当前 DOM 尺寸重算坐标（文字轮播等导致宽高变化时保持约束，如贴右缘） */
  function reclampLayerPosition(key: K) {
    const layer = opts.layers.find(l => l.key === key)!
    if (!isLayerActive(layer))
      return
    if (!layer.elRef.value)
      return
    clampViewportPointRefToElement(
      positions[key],
      layer.elRef,
      40,
      40,
      opts.dragConstraint,
    )
  }

  function reclampPersist() {
    nextTick(() => {
      for (const layer of opts.layers)
        reclampLayerPosition(layer.key)
      persist()
    })
  }

  function bootstrapLayout(sideEffect?: () => void) {
    nextTick(() => {
      hydrateAll()
      if (hideUntilHydrated)
        layoutReady.value = true
      sideEffect?.()
    })
  }

  /** shallow：避免 Vue 深层解包每层里的 Ref（position）、与 `.value`/类型一致 */
  const layers = shallowReactive({}) as Record<K, ViewportFloatingGroupLayerApi>

  for (const layer of opts.layers) {
    const k = layer.key
    const drag = useViewportDraggableFloating(positions[k], layer.elRef, {
      onDragCommit: persist,
      dragConstraint: opts.dragConstraint,
    })

    layers[k] = {
      position: positions[k],
      dragging: drag.dragging,
      suppressClickAfterDrag: drag.suppressClickAfterDrag,
      onPointerDown: drag.onPointerDown,
      swallowFollowingClick: drag.swallowFollowingClick,
    }
  }

  function onResize() {
    reclampPersist()
  }

  const layerSizeObservers = new Map<K, ResizeObserver>()

  function setupLayerSizeObserver(layer: ViewportFloatingGroupLayer<K>) {
    const key = layer.key
    if (layerSizeObservers.has(key))
      return

    const observer = new ResizeObserver(() => {
      reclampLayerPosition(key)
    })
    layerSizeObservers.set(key, observer)

    watch(
      () => layer.elRef.value,
      (el, prevEl) => {
        if (prevEl)
          observer.unobserve(prevEl)
        if (el)
          observer.observe(el)
      },
      { immediate: true },
    )
  }

  for (const layer of opts.layers)
    setupLayerSizeObserver(layer)

  onMounted(() => {
    window.addEventListener('resize', onResize, { passive: true })
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    layerSizeObservers.forEach(observer => observer.disconnect())
    layerSizeObservers.clear()
  })

  return {
    layoutReady,
    /** `nextTick` 内 hydrate + 可选首屏展示就绪 */
    bootstrapLayout,
    /** 单层恢复（常用于某层 delayed v-if） */
    hydrateKey,
    /** 全体按缓存或默认坐标恢复一遍（按 layers 声明顺序 hydrate） */
    hydrateAll,
    layers,
    persist,
    /** 视口缩放后裁剪并写缓存；一般由内部 resize 自动调用 */
    reclampPersist,
  }
}
