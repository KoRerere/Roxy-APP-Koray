import type { BrowserItem } from './browserItem'
import type { BrowserManager } from './browserManager'
import type { ArrangeGridOptions, DisplayLayoutInput } from '/@/utils/windowGridLayout'
import { watch } from '@vue/reactivity'
import { globalShortcut, screen } from 'electron'
import { isDev } from '/@/constants/common'
import { browserManager } from '/@/modules/browser'
import { computeWindowGridLayouts, sortDisplaysSpatial } from '/@/utils/windowGridLayout'

/** Electron：Win/Linux Ctrl+Alt+K；macOS 为 Control+Option+K */
export const CHUNK_LAYOUT_REFLOW_ACCELERATOR = 'Ctrl+Alt+K'

export interface ChunkLayoutSnapshot {
  orderedDirIds: string[]
  gridOpts: ArrangeGridOptions
}

let snapshot: ChunkLayoutSnapshot | null = null

export function setChunkLayoutSnapshot(next: ChunkLayoutSnapshot) {
  snapshot = {
    orderedDirIds: [...next.orderedDirIds],
    gridOpts: {
      ...next.gridOpts,
      stackOffset: next.gridOpts.stackOffset
        ? { ...next.gridOpts.stackOffset }
        : undefined,
    },
  }
}

/** 最近一次 chunk 布局快照（未触发过则为 null），供调试或扩展使用 */
export function getChunkLayoutSnapshot(): ChunkLayoutSnapshot | null {
  return snapshot
}

async function setChromeBrowserWindowBounds(browserItem: BrowserItem, bounds: {
  left: number
  top: number
  width: number
  height: number
}) {
  const browser = browserItem.getBrowser()
  const Browser = browser?.client?.Browser
  if (!Browser?.getWindowForTarget || typeof Browser.setWindowBounds !== 'function') {
    throw new Error('CDP Browser window APIs unavailable')
  }

  const pages = await browser!.pages()
  const firstPage = pages?.at(0)
  if (!firstPage) {
    throw new Error('no pages')
  }
  const targetId = firstPage.target()._targetId
  const { windowId } = await Browser.getWindowForTarget({ targetId })
  await Browser.setWindowBounds({
    windowId,
    bounds: {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      windowState: 'normal',
    },
  })
}

/**
 * 按最近一次「按屏幕宫格打开」快照，将仍为打开状态的 Chromium 窗口重排到当前显示器网格。
 */
export async function applyChunkLayoutReflow(): Promise<void> {
  const snap = getChunkLayoutSnapshot()
  if (!snap?.orderedDirIds.length) {
    if (isDev)
      console.debug('[chunkLayoutReflow] No snapshot, skip.')

    return
  }

  const activeIds = snap.orderedDirIds.filter(id =>
    browserManager.openedBrowserMap.has(id))
  if (!activeIds.length)
    return

  const displays: DisplayLayoutInput[] = sortDisplaysSpatial(
    screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
    })),
  )

  const layouts = computeWindowGridLayouts(displays, activeIds.length, snap.gridOpts)

  await Promise.allSettled(
    activeIds.map(async (dirId, i) => {
      const layout = layouts[i]
      const item = browserManager.openedBrowserMap.get(dirId)
      if (!layout || !item)
        return

      if (item.isFirefox) {
        console.debug(`[chunkLayoutReflow] Firefox profile skipped (no CDP bounds): ${dirId}`)
        return
      }

      try {
        await setChromeBrowserWindowBounds(item, {
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
        })
      }
      catch (e) {
        console.warn(`[chunkLayoutReflow] failed for dirId=${dirId}`, e)
      }
    }),
  )
}

/** 先于 register 静默注销本加速器（避免 Electron 替换失败时需要先腾位） */
function unregisterChunkReflowAcceleratorQuiet(): void {
  globalShortcut.unregister(CHUNK_LAYOUT_REFLOW_ACCELERATOR)
}

/**
 * 注册全局快捷键 Ctrl+Alt+K；若与其它程序冲突则可能返回 false。
 */
export function registerChunkLayoutReflowShortcut(): boolean {
  unregisterChunkReflowAcceleratorQuiet()

  const ok = globalShortcut.register(CHUNK_LAYOUT_REFLOW_ACCELERATOR, () => {
    void applyChunkLayoutReflow().catch((err) => {
      console.error('[chunkLayoutReflow] shortcut handler:', err)
    })
  })

  if (!ok && isDev) {
    console.warn(
      `[chunkLayoutReflow] Failed to register "${CHUNK_LAYOUT_REFLOW_ACCELERATOR}". It may be taken by another app.`,
    )
  }

  return ok
}

/** 注销快捷键并清空快照（例如已无打开的浏览器配置文件窗口） */
export function unregisterChunkLayoutReflowShortcut(): void {
  unregisterChunkReflowAcceleratorQuiet()
  snapshot = null
}

let shortcutLifecycleInstalled = false

/**
 * 监听「配置文件浏览器」数量：仅在仍有打开的浏览器窗口时需要保留快捷键；
 * 与 MCP / syncControl 的全局快捷键注销互不耦合。
 */
export function setupChunkReflowShortcutLifecycle(manager: BrowserManager): void {
  if (shortcutLifecycleInstalled)
    return
  shortcutLifecycleInstalled = true

  watch(manager.openedBrowserMap, () => {
    queueMicrotask(() => {
      if (manager.openedBrowserMap.size === 0)
        unregisterChunkLayoutReflowShortcut()
    })
  })
}
