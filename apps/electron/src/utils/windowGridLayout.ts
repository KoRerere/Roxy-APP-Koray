/**
 * 多显示器窗口网格布局 + 整块虚拟工作台 workArea 外包矩形（DIP）。
 * chunk 铺满与 windowRatioPosition 换算共用本文件。
 */

import { screen } from 'electron'

// ---------------------------------------------------------------------------
// 虚拟工作台 workArea 外包矩形（windowRatioPosition 比例基准）
// ---------------------------------------------------------------------------

export interface VirtualWorkAreaUnion {
  originX: number
  originY: number
  width: number
  height: number
}

/**
 * 当前所有显示器 workArea 的外包矩形（DIP）。
 * windowRatioPosition 的 x/y 解释为相对该矩形的锚点（与 Chromium 虚拟桌面坐标一致）。
 */
export function getVirtualWorkAreaUnion(): VirtualWorkAreaUnion {
  const displays = screen.getAllDisplays()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const d of displays) {
    const { x, y, width, height } = d.workArea
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  if (!Number.isFinite(minX)) {
    const p = screen.getPrimaryDisplay()
    const wa = p.workArea
    return {
      originX: wa.x,
      originY: wa.y,
      width: Math.max(1, wa.width),
      height: Math.max(1, wa.height),
    }
  }

  return {
    originX: minX,
    originY: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

/** 绝对左上角 DIP → windowRatioPosition 字符串（左上锚点 tl） */
export function absoluteTopLeftToWindowRatioPosition(
  topLeftX: number,
  topLeftY: number,
  bounds: VirtualWorkAreaUnion,
): string {
  const vw = bounds.width || 1
  const vh = bounds.height || 1
  const rx = (topLeftX - bounds.originX) / vw
  const ry = (topLeftY - bounds.originY) / vh
  return `${rx},${ry},tl`
}

// ---------------------------------------------------------------------------
// 4×2 网格（前几屏铺满、最后一屏末格堆叠）
// ---------------------------------------------------------------------------

export interface DisplayLayoutInput {
  id: number
  bounds: { x: number, y: number, width: number, height: number }
  workArea: { x: number, y: number, width: number, height: number }
}

export interface WindowRect {
  displayId: number
  x: number
  y: number
  width: number
  height: number
  stackIndex: number
}

export interface ArrangeGridOptions {
  cols?: number
  rows?: number
  gap?: number
  stackOffset?: { x: number, y: number }
}

function lastSlot(cols: number, rows: number) {
  return cols * rows - 1
}

/** 先填满前几屏（每屏最多 slotsPer），剩余全部划归最后一屏。 */
export function countsFillFirstScreens(
  displayCount: number,
  windowCount: number,
  slotsPerScreen: number,
): number[] {
  const counts = Array.from({ length: displayCount }).fill(0)
  let remaining = windowCount
  for (let i = 0; i < displayCount; i++) {
    const isLast = i === displayCount - 1
    if (isLast) {
      counts[i] = remaining
      break
    }
    const take = Math.min(slotsPerScreen, remaining)
    counts[i] = take
    remaining -= take
  }
  return counts as number[]
}

/**
 * displays 请先按 spatial 排序再传入。
 */
export function computeWindowGridLayouts(
  displays: DisplayLayoutInput[],
  windowCount: number,
  opts: ArrangeGridOptions = {},
): WindowRect[] {
  const cols = opts.cols ?? 4
  const rows = opts.rows ?? 2
  const gap = opts.gap ?? 0
  const stackOffset = opts.stackOffset ?? { x: 24, y: 24 }

  const slots = cols * rows
  const last = lastSlot(cols, rows)

  if (!displays.length || windowCount <= 0)
    return []

  const perDisplay = countsFillFirstScreens(displays.length, windowCount, slots)
  const out: WindowRect[] = []

  for (let di = 0; di < displays.length; di++) {
    const d = displays[di]
    const n = perDisplay[di]
    const { x: wax, y: way, width: waw, height: wah } = d.workArea

    const innerW = Math.max(0, waw - gap * (cols + 1))
    const innerH = Math.max(0, wah - gap * (rows + 1))
    const cellW = Math.floor(innerW / cols)
    const cellH = Math.floor(innerH / rows)

    const baseX = wax + gap
    const baseY = way + gap

    for (let wi = 0; wi < n; wi++) {
      const slotIndex = Math.min(wi, last)
      const col = slotIndex % cols
      const row = Math.floor(slotIndex / cols)
      let x = baseX + col * (cellW + gap)
      let y = baseY + row * (cellH + gap)

      let stackIndex = 0
      if (wi >= slots) {
        stackIndex = wi - (slots - 1)
        x += stackIndex * stackOffset.x
        y += stackIndex * stackOffset.y
      }

      out.push({
        displayId: d.id,
        x: Math.round(x),
        y: Math.round(y),
        width: cellW,
        height: cellH,
        stackIndex,
      })
    }
  }

  return out
}

/** 与其它逻辑解耦的稳定空间排序（左→右、上→下） */
export function sortDisplaysSpatial(displays: DisplayLayoutInput[]): DisplayLayoutInput[] {
  return [...displays].sort((a, b) =>
    a.bounds.x !== b.bounds.x ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y,
  )
}

/** 将网格结果转为 batchLaunch — customParamsByDirId（windowRatioPosition 相对整块虚拟工作台 workArea） */
export function buildChunkLaunchParamsByDirId(
  dirIds: string[],
  layouts: WindowRect[],
): Record<string, {
  openWidth: string
  openHeight: string
  positionSwitch: boolean
  windowRatioPosition: string
}> {
  const virtualBounds = getVirtualWorkAreaUnion()
  const map: Record<string, any> = {}
  for (let i = 0; i < dirIds.length; i++) {
    const layout = layouts[i]
    if (!layout)
      continue
    map[dirIds[i]] = {
      openWidth: String(layout.width),
      openHeight: String(layout.height),
      positionSwitch: true,
      windowRatioPosition: absoluteTopLeftToWindowRatioPosition(layout.x, layout.y, virtualBounds),
    }
  }
  return map
}
