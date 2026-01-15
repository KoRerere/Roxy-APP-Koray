import type { JumpListItem } from 'electron'
import { app, Menu } from 'electron'
import { debounce, isString } from 'es-toolkit'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path, { normalize } from 'node:path'
import { appConfig } from '/@/constants'
import { isMac, isWindows } from '/@/constants/common'
import { dispatchRoxyAction } from '/@/modules/app'
import { store } from '/@/modules/store'

interface ShortcutItem {
  launcherEntry: string
  /** Windows 开始菜单「所有应用」入口 */
  startMenuEntry?: string
  program: string
  arguments: string
  title: string
}

/**
 * ShortcutStore：用于保存/读取 shortcut 元数据（`shortcuts.json`）
 */
class ShortcutStore {
  private storePath: string
  private data: Record<string, ShortcutItem> | null = null

  constructor() {
    this.storePath = appConfig.shortcutsConfigFile
    this.initTaskbar()
  }

  /** 任务栏 */
  async initTaskbar() {
    await this.ensureLoaded()
    await app.whenReady()

    // Windows：JumpList Tasks（任务栏右键菜单）
    // macOS：Dock 菜单
    // Linux：暂不提供统一的“任务栏 API”，这里保证不报错，后续可扩展（例如 .desktop Actions）
    if (isWindows) {
      // 参考：https://www.electronjs.org/docs/latest/tutorial/windows-taskbar
      // 注意：历史数据里可能存在 string 等旧结构；同时 Electron 对空 category/items 的校验较严格，
      // 这里统一做过滤 + 规范化，保证入参永远是 `null` 或 `JumpListCategory[]`。
      const jumpListItems: JumpListItem[] = Object.values(this.data ?? {})
        .flatMap((item: ShortcutItem) => {
          if (!item || typeof item === 'string')
            return []
          const title = String(item.title ?? '').trim()
          const args = String(item.arguments ?? '').trim()
          if (!title || !args)
            return []
          return [{
            type: 'task',
            program: process.execPath,
            args: `${args} --roxy-action=launch-browser`,
            iconPath: process.execPath,
            iconIndex: 0,
            title,
            description: title,
          } as JumpListItem]
        })

      if (jumpListItems.length) {
        app.setJumpList([{
          type: 'custom',
          name: $t('快捷方式'),
          items: jumpListItems,
        }])
      }
    }

    if (isMac && app.dock) {
      const dockMenu = Menu.buildFromTemplate(Object.entries(this.data!).map(([key, item]) => {
        return {
          id: key,
          label: item.title,
          click: () => {
            console.debug('dock menu click', key, item)
            const argv = `${item.arguments} --roxy-action=launch-browser`.trim().split(/\s+/)
            dispatchRoxyAction(argv, 'dock-menu')
          },
        }
      }))

      app.dock.setMenu(dockMenu)
    }
  }

  private async ensureLoaded() {
    if (this.data)
      return
    try {
      const raw = await readFile(this.storePath, 'utf-8')
      this.data = JSON.parse(raw || '{}')
    }
    catch {
      // 文件不存在或损坏：尝试创建空 store
      await mkdir(path.dirname(this.storePath), { recursive: true })
      this.data = {}
      await this.save()
    }
  }

  private save = debounce(async () => {
    await this.ensureLoaded()
    await writeFile(this.storePath, JSON.stringify(this.data, null, 2), 'utf-8')
    this.initTaskbar()
  }, 100)

  async get(id: string) {
    await this.ensureLoaded()
    const item = this.data![id]
    // TODO: 兼容旧版本
    if (isString(item)) {
      return {
        launcherEntry: item,
        program: process.execPath,
        arguments: `--dir-id=${id} --workspace-id=${store.workspaceId}`,
        title: $t('默认浏览器'),
      } as ShortcutItem
    }

    return item
  }

  async set(dirId: string, shortcutItem: ShortcutItem) {
    await this.ensureLoaded()
    this.data![dirId] = shortcutItem
    await this.save()
    this.initTaskbar()
  }

  async remove(id: string) {
    await this.ensureLoaded()
    const oldShortcutItem = this.data![id]
    Reflect.deleteProperty(this.data, id)
    if (oldShortcutItem) {
      rm(normalize(oldShortcutItem.launcherEntry), { recursive: true, force: true }).catch((e) => {
        console.error('delete old shortcut failed', e)
      })
      if (oldShortcutItem?.startMenuEntry) {
        rm(normalize(oldShortcutItem.startMenuEntry), { recursive: true, force: true }).catch(() => undefined)
      }
    }
    await this.save()
    this.initTaskbar()
  }

  async shortcuts() {
    await this.ensureLoaded()
    return this.data!
  }
}

export const shortcutStore = new ShortcutStore()
