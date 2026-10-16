import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getUserDataDirPath } from '/@/modules/browser/browser-manager/utils'

/** 窗口关闭前的位置与大小，只留在该窗口的 browser-cache 目录，不参与 OSS 同步 */
export interface LastWindowBounds {
  left: number
  top: number
  width: number
  height: number
}

/** 与同步文件列表分开，删除窗口时随 userDataDir 一起被删掉 */
export const LAST_WINDOW_BOUNDS_FILE = 'last-window-bounds.json'

const FIREFOX_XUL_WINDOW_KEY = 'chrome://browser/content/browser.xhtml'

/** 上次关闭位置文件路径 */
export function getLastWindowBoundsPath(dirId: string) {
  return join(getUserDataDirPath(dirId), LAST_WINDOW_BOUNDS_FILE)
}

/** 四个字段都必须是有限数，且宽高为正，否则视为没有可用记录 */
export function parseLastWindowBounds(value: unknown): LastWindowBounds | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  const bounds = {
    left: Number(raw.left),
    top: Number(raw.top),
    width: Number(raw.width),
    height: Number(raw.height),
  }
  if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)) {
    return null
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }
  return bounds
}

/** 写入上次关闭位置。目录由浏览器 profile 保证存在，文件本身不进同步清单 */
export async function writeLastWindowBounds(dirId: string, bounds: LastWindowBounds) {
  await writeFile(getLastWindowBoundsPath(dirId), JSON.stringify(bounds), 'utf-8')
}

/** 读取上次关闭位置。文件不存在或内容无效时返回 null，调用方回退到窗口配置 */
export async function readLastWindowBounds(dirId: string): Promise<LastWindowBounds | null> {
  try {
    const raw = await readFile(getLastWindowBoundsPath(dirId), 'utf-8')
    return parseLastWindowBounds(JSON.parse(raw))
  }
  catch {
    return null
  }
}

/**
 * 从 Firefox profile 的 xulstore.json 取出关闭前的窗口几何。
 * 下次启动会按配置重写 xulstore，所以必须在进程退出后立刻抄到独立文件。
 */
export async function readFirefoxXulstoreBounds(profileDir: string): Promise<LastWindowBounds | null> {
  try {
    const raw = await readFile(join(profileDir, 'xulstore.json'), 'utf-8')
    const xulstore = JSON.parse(raw) as Record<string, Record<string, Record<string, unknown>>>
    const win = xulstore[FIREFOX_XUL_WINDOW_KEY]?.['main-window']
    if (!win) {
      return null
    }
    return parseLastWindowBounds({
      left: win.screenX,
      top: win.screenY,
      width: win.width,
      height: win.height,
    })
  }
  catch {
    return null
  }
}

/** 当前已连接显示器的工作区（DIP）。原点可以是负数，外接屏在主屏左侧或上方时如此 */
export interface WorkAreaRect {
  x: number
  y: number
  width: number
  height: number
}

/** 与层叠布局同一错位，避免多扇被挪回的窗口完全叠在主屏左上角 */
const RELOCATE_OFFSET = 32
const RELOCATE_MAX_STEPS = 8

/** 转成 batchLaunch 的单窗口覆盖参数：绝对坐标优先于比例位置 */
export function toLastClosedLaunchParams(bounds: LastWindowBounds) {
  return {
    positionSwitch: true as const,
    openWidth: bounds.width,
    openHeight: bounds.height,
    windowAbsolutePosition: `${bounds.left},${bounds.top}`,
  }
}

/**
 * 把上次关闭坐标收进当前已连接的显示器。
 * 外接屏拔掉后，绝对坐标会落在虚拟桌面外，窗口无法拖回。
 * 仍与某块工作区相交时，收进相交面积最大的那块；完全不相交时，放到列表中的第一块（调用方应把主屏放前面）并逐个错开。
 */
export function fitLastClosedBounds(
  bounds: LastWindowBounds,
  workAreas: WorkAreaRect[],
  relocateStep = 0,
): { bounds: LastWindowBounds, relocated: boolean } {
  const usable = workAreas.filter(area => area.width > 0 && area.height > 0)
  if (!usable.length) {
    return { bounds, relocated: false }
  }

  const target = pickLargestOverlap(bounds, usable)
  if (target) {
    return { bounds: clampInside(bounds, target), relocated: false }
  }

  return { bounds: placeOn(usable[0]!, bounds, relocateStep), relocated: true }
}

/** 相交面积最大的工作区。面积相同保留先出现的，便于主屏优先 */
function pickLargestOverlap(bounds: LastWindowBounds, workAreas: WorkAreaRect[]): WorkAreaRect | null {
  let best: { area: WorkAreaRect, overlap: number } | null = null
  for (const area of workAreas) {
    const overlap = overlapArea(bounds, area)
    if (overlap <= 0) {
      continue
    }
    if (!best || overlap > best.overlap) {
      best = { area, overlap }
    }
  }
  return best?.area ?? null
}

function overlapArea(bounds: LastWindowBounds, area: WorkAreaRect) {
  const width = Math.min(bounds.left + bounds.width, area.x + area.width) - Math.max(bounds.left, area.x)
  const height = Math.min(bounds.top + bounds.height, area.y + area.height) - Math.max(bounds.top, area.y)
  if (width <= 0 || height <= 0) {
    return 0
  }
  return width * height
}

/** 宽高不超过工作区，左上角拉回工作区内，保证整扇窗口可点 */
function clampInside(bounds: LastWindowBounds, area: WorkAreaRect): LastWindowBounds {
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  return {
    left: Math.round(clamp(bounds.left, area.x, area.x + area.width - width)),
    top: Math.round(clamp(bounds.top, area.y, area.y + area.height - height)),
    width: Math.round(width),
    height: Math.round(height),
  }
}

/** 完全落在现有屏幕外时，按窗口自身大小放进目标工作区，多扇窗口错开避免互相挡住 */
function placeOn(area: WorkAreaRect, bounds: LastWindowBounds, step: number): LastWindowBounds {
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  const maxSteps = Math.max(0, Math.min(
    RELOCATE_MAX_STEPS,
    Math.floor(Math.max(area.width - width, 0) / RELOCATE_OFFSET),
    Math.floor(Math.max(area.height - height, 0) / RELOCATE_OFFSET),
  ))
  const stackIndex = step % (maxSteps + 1)
  return {
    left: Math.round(area.x + stackIndex * RELOCATE_OFFSET),
    top: Math.round(area.y + stackIndex * RELOCATE_OFFSET),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
