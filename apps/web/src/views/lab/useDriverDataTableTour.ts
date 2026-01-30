import type { Config, Driver } from 'driver.js'
import { genDriver, sleep } from '/@/utils'

type RootEl = HTMLElement

type CellGetter = (rootEl: RootEl) => HTMLElement[]

export interface RectPick {
  /**
   * 0-based：tbody 渲染出来的行
   */
  rows: number[]
  /**
   * 0-based：列索引（看 mode）
   */
  cols: number[]
  /**
   * data: 过滤 selection/expander/editor 等“工具列”后再数列（推荐）
   * dom: 直接按 DOM td 顺序数列（包含工具列）
   */
  mode?: 'data' | 'dom'

  /**
   * data 模式下：额外排除哪些 td
   * - 默认会排除 selection/row toggler/editor 这些常见工具列
   * - 你也可以加更多 class
   */
  excludeTdClassNames?: string[]
}

export type CellPick
  = | { rect: RectPick }
    | { selector: string } // 以 DataTable 根节点为范围
    | { getCells: CellGetter }

export interface DataTableTourStep {
  pick: CellPick
  popover: {
    title?: string
    description?: string
    side?: 'left' | 'right' | 'top' | 'bottom'
    align?: 'start' | 'center' | 'end'
  }
  beforeHighlight?: () => void | Promise<void>
  afterLeave?: () => void | Promise<void>
}

export interface UseDriverDataTableTourOptions {
  getRootEl?: () => RootEl | null
  virtualTargetZIndex?: number
  settleMs?: number
}

export interface DriveOptions {
  el: RootEl | undefined
  steps: DataTableTourStep[]
  options?: Config
  startIndex?: number
}

/** ---------- 虚拟 target ---------- */
function ensureVirtualTarget(id: string, zIndex: number) {
  let el = document.getElementById(id) as HTMLElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.style.position = 'fixed'
    el.style.pointerEvents = 'none'
    el.style.zIndex = String(zIndex)
    el.style.top = '-9999px'
    el.style.left = '-9999px'
    el.style.width = '1px'
    el.style.height = '1px'
    document.body.appendChild(el)
  }
  return el
}

function updateVirtualTarget(target: HTMLElement, cells: HTMLElement[]) {
  if (!cells.length) {
    target.style.top = '-9999px'
    target.style.left = '-9999px'
    target.style.width = '1px'
    target.style.height = '1px'
    return
  }
  const rects = cells.map(el => el.getBoundingClientRect())
  const top = Math.min(...rects.map(r => r.top))
  const left = Math.min(...rects.map(r => r.left))
  const right = Math.max(...rects.map(r => r.right))
  const bottom = Math.max(...rects.map(r => r.bottom))

  target.style.top = `${top}px`
  target.style.left = `${left}px`
  target.style.width = `${Math.max(0, right - left)}px`
  target.style.height = `${Math.max(0, bottom - top)}px`
}

function removeEl(el: Element | null | undefined) {
  if (el?.parentNode)
    el.parentNode.removeChild(el)
}

/** ---------- PrimeVue frozen 兼容：拿到所有 table，并按 frozen 优先排序 ---------- */
function getAllTables(root: RootEl): HTMLTableElement[] {
  const tables = Array.from(root.querySelectorAll('.p-datatable-table')) as HTMLTableElement[]

  // frozen 视图一般有类似 .p-datatable-frozen-view 容器（不同版本 class 可能略有差异）
  /**
   * 这里用 closest 做一个“优先 frozen”排序，避免拼接列时顺序反了。
   */
  const score = (t: Element) => (t.closest('.p-datatable-frozen-view') ? 0 : 1)

  return tables.sort((a, b) => score(a) - score(b))
}

/** 同一行：把 frozen table 的那一行 td + unfrozen table 的那一行 td 合并 */
function getRowCellsAcrossTables(tables: HTMLTableElement[], rowIndex: number): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const table of tables) {
    const tbody = table.querySelector('.p-datatable-tbody') as HTMLElement | null
    if (!tbody)
      continue
    const tr = tbody.querySelectorAll(':scope > tr')[rowIndex] as HTMLTableRowElement | undefined
    if (!tr)
      continue
    const tds = Array.from(tr.querySelectorAll(':scope > td')) as HTMLElement[]
    out.push(...tds)
  }
  return out
}

function filterDataTds(tds: HTMLElement[], extraExclude: string[] = []) {
  // 默认排除：selection / row toggler / row editor 常见工具列
  const defaultExclude = [
    'p-selection-column',
    'p-row-toggler',
    'p-row-editor',
    'p-expander-column',
  ]

  const exclude = new Set([...defaultExclude, ...extraExclude])

  return tds.filter((td) => {
    for (const cls of exclude) {
      if (td.classList.contains(cls))
        return false
    }
    return true
  })
}

/** ---------- 统一的 cells picking ---------- */
function pickCells(root: RootEl, pick: CellPick): HTMLElement[] {
  if ('getCells' in pick)
    return pick.getCells(root)

  if ('selector' in pick) {
    return Array.from(root.querySelectorAll(pick.selector)) as HTMLElement[]
  }

  const { rows, cols, mode = 'data', excludeTdClassNames = [] } = pick.rect

  const tables = getAllTables(root)
  if (!tables.length)
    return []

  const cells: HTMLElement[] = []
  for (const r of rows) {
    const rowTdsDom = getRowCellsAcrossTables(tables, r)
    const rowTds = mode === 'data' ? filterDataTds(rowTdsDom, excludeTdClassNames) : rowTdsDom

    for (const c of cols) {
      const td = rowTds[c]
      if (td)
        cells.push(td)
    }
  }
  return cells
}

/** ---------- composable ---------- */
export function useDriverDataTableTour(options?: UseDriverDataTableTourOptions) {
  const {
    getRootEl,
    virtualTargetZIndex,
    settleMs,
  } = { virtualTargetZIndex: 999999, settleMs: 0, ...options }

  let driverObj: Driver | null = null
  let virtualTargets: HTMLElement[] = []

  function cleanup() {
    if (driverObj?.isActive())
      driverObj.destroy()
    driverObj = null

    for (const el of virtualTargets) removeEl(el)
    virtualTargets = []
  }

  async function drive({ el, steps, options, startIndex = 0 }: DriveOptions) {
    cleanup()

    await nextTick()
    if (settleMs > 0)
      await sleep(settleMs)
    else await sleep(0)

    const root = el ?? getRootEl?.()
    if (!root)
      return

    const uid = Math.random().toString(36).slice(-6)
    const targetIds = steps.map((_, i) => `driver_dt_virtual_${uid}_${i}`)
    virtualTargets = targetIds.map(id => ensureVirtualTarget(id, virtualTargetZIndex))

    // 预计算一次，避免初始 popover 定位 0,0
    steps.forEach((s, i) => updateVirtualTarget(virtualTargets[i]!, pickCells(root, s.pick)))

    driverObj = genDriver({
      animate: true,
      overlayOpacity: 0.6,
      allowKeyboardControl: true,
      ...options,
      onDestroyed: (...args) => {
        cleanup()
        options?.onDestroyed?.(...args)
      },

      steps: steps.map((s, i) => ({
        element: `#${targetIds[i]}`,
        popover: {
          title: s.popover.title,
          description: s.popover.description,
          side: s.popover.side ?? 'bottom',
          align: s.popover.align ?? 'start',
        },
        onHighlightStarted: async () => {
          if (s.beforeHighlight)
            await s.beforeHighlight()
          await sleep(0)
          const r = el ?? getRootEl?.()
          if (!r)
            return
          updateVirtualTarget(virtualTargets[i]!, pickCells(r, s.pick))
        },
        onDeselected: async () => {
          updateVirtualTarget(virtualTargets[i]!, [])
          if (s.afterLeave)
            await s.afterLeave()
        },
      })),
    })

    driverObj.drive(startIndex)
  }

  function destroy() {
    cleanup()
  }

  onBeforeUnmount(() => cleanup())

  return {
    drive,
    destroy,
    isActive: () => !!driverObj?.isActive(),
  }
}
