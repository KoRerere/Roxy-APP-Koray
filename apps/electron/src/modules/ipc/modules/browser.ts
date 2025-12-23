import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { app as electronApp } from 'electron'
import { spawn } from 'node:child_process'
import { access, chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import type { IPCMainInstance } from '/@/modules/ipc/types'
import { appConfig } from '/@/constants'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import { resourceUpdater } from '/@/modules/updater'

async function pathExists(p: string) {
  try {
    await access(p)
    return true
  }
  catch {
    return false
  }
}

async function spawnWait(command: string, args: string[], options: SpawnOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options as any) as unknown as ChildProcess
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0)
        resolve()
      else
        reject(new Error(`[spawnWait] ${command} exited with code=${code} signal=${signal ?? ''}`.trim()))
    })
  })
}

export function setupBrowserIpc(ipcMain: IPCMainInstance) {
  /** 批量启动浏览器 */
  ipcMain.on('browser:batchLaunch', (_event, dirIds) => {
    return browserManager.batchLaunch(dirIds)
  })

  /** 批量关闭浏览器 */
  ipcMain.on('browser:batchClose', (_event, dirIds: string[]) => {
    return browserManager.batchClose(dirIds)
  })

  /** 关闭所有浏览器 */
  ipcMain.on('browser:closeAll', (_event) => {
    return browserManager.closeAll()
  })

  /** 批量重启浏览器 */
  ipcMain.on('browser:batchRelaunch', (_event, dirIds) => {
    return browserManager.batchReLaunch(dirIds)
  })

  /** 批量删除本地浏览器 */
  ipcMain.on('browser:batchRemove', (_event, dirIds) => {
    return browserManager.batchDelete(dirIds)
  })

  /** 根据进程 PID 判断进程是否存在 */
  ipcMain.on('browser:isProcessExists', (_event, dirIds) => {
    return Promise.all(dirIds.map(async (dirId) => {
      const browserItem = browserManager.openedBrowserMap.get(dirId)
      const isExists = Boolean(await browserItem?.beforeLaunchTask.reconnectBrowser())
      if (!isExists) {
        browserItem?.handleOnDisconnected()
      }
      return isExists
    }))
  })

  /** 获取正在使用中的内核 */
  ipcMain.on('browser:usingCores', (_event) => {
    return [...chromeCoreManager.usingCores]
  })

  /** 获取所有已打开的窗口 */
  ipcMain.on('browser:getOpenedBrowser', (_event) => {
    return browserManager.openedBrowserList
  })

  /** 获取所有已打开的窗口数量 */
  ipcMain.on('browser:getOpenedBrowserCount', (_event, targetWorkspaceId?: number) => {
    return browserManager.openedBrowserList
      .filter(item => targetWorkspaceId ? item.workspaceId === targetWorkspaceId : true)
      .length
  })

  /** 获取所有已打开的窗口的消息 */
  ipcMain.on('browser:getOpenedBrowserMessage', (_event) => {
    return [
      ...browserManager.openedBrowserMap.values(),
      ...browserManager.openingBrowserMap.values().map(item => item.browserItem),
    ].map(browserItem => browserItem.lastMessage!)
  })

  /**
   * 清除浏览器缓存
   * @param type 清除类型
   * excludeExtension 清除本地缓存，保留插件
   * all 清除本地缓存
   */
  ipcMain.on('browser:clearCache', async (_event, payload) => {
    const { clearType, dirIds } = payload
    if (clearType === 'all') {
      // 清除本地缓存
      console.log('Clearing local cache', dirIds)
      return Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalData(dirId)))
    }
    else if (clearType === 'partial') {
      // 清除本地缓存，保留插件
      console.log('Clearing local cache, keeping extensions', dirIds)
      return Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalDataExcludeExtension(dirId)))
    }
  })

  ipcMain.on('browser:clearCacheByTimestamp', async (_event, payload) => {
    return browserManager.clearCacheByTimestamp(payload)
  })

  /** 设为默认浏览器 */
  ipcMain.on('browser:setAsDefaultBrowser', async (_event, dirId) => {
    try {
      store.defaultBrowserDirId = dirId

      const sourceAppPath = {
        darwin: join(appConfig.sessionDir, 'default-browser-bin', 'roxybrowser.app'),
        win32: join(appConfig.sessionDir, 'default-browser-bin', 'roxybrowser.exe'),
        linux: join(appConfig.sessionDir, 'default-browser-bin', 'roxybrowser'),
      }[process.platform]

      if (!(await pathExists(sourceAppPath))) {
        console.error(`[browser:setAsDefaultBrowser] source app path not found: ${sourceAppPath}`)
        await resourceUpdater.checkForUpdates()
        if (!(await pathExists(sourceAppPath))) {
          console.debug(`[browser:setAsDefaultBrowser] checkForUpdates failed`)
          return
        }
      }

      // macOS：复制到 /Applications（需要管理员权限）
      if (process.platform === 'darwin') {
        const targetAppPath = '/Applications/roxybrowser.app'
        const targetAppBinPath = '/Applications/roxybrowser.app/Contents/MacOS/roxybrowser'

        // 需要管理员权限写 /Applications：用 osascript 触发系统授权弹窗
        await spawnWait('osascript', [
          '-e',
          `do shell script "rm -rf '${targetAppPath}' && ditto '${sourceAppPath}' '${targetAppPath}'" with administrator privileges`,
        ], { stdio: 'inherit' })

        spawn(
          targetAppBinPath,
          ['--set-default-browser', `--roxy-default-browser-config-path=${appConfig.defaultBrowserConfig}`],
          { detached: true, stdio: 'ignore' },
        ).unref()
        return
      }

      // Windows：复制绿色版到桌面（无需管理员权限），然后执行设置默认浏览器
      if (process.platform === 'win32') {
        // 只在桌面放一个快捷方式（不放目录），实际把 exe 安装到用户目录（无需管理员权限）
        const localAppData
          = process.env.LOCALAPPDATA
            ?? process.env.APPDATA?.replace(/\\Roaming$/i, '\\Local')
            ?? electronApp.getPath('userData')
        const installDir = join(localAppData, 'roxybrowser')
        const targetExePath = join(installDir, 'roxybrowser.exe')

        await mkdir(installDir, { recursive: true })
        await copyFile(sourceAppPath, targetExePath)

        // 在桌面创建快捷方式（.lnk）
        try {
          const desktopDir = electronApp.getPath('desktop')
          const lnkPath = join(desktopDir, 'Roxy Browser.lnk')
          // 快捷方式用于“正常打开应用”，不要带 --set-default-browser
          // 用 WScript.Shell 创建 .lnk
          const ps = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('${lnkPath.replace(/'/g, '\'\'')}')
$s.TargetPath = '${targetExePath.replace(/'/g, '\'\'')}'
$s.Arguments = ''
$s.WorkingDirectory = '${installDir.replace(/'/g, '\'\'')}'
$s.IconLocation = '${targetExePath.replace(/'/g, '\'\'')},0'
$s.Save()
`.trim()
          await spawnWait('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { stdio: 'ignore' })
        }
        catch {
          // ignore: 创建快捷方式失败不影响后续注册逻辑
        }

        spawn(
          targetExePath,
          ['--set-default-browser', `--roxy-default-browser-config-path=${appConfig.defaultBrowserConfig}`],
          { detached: true, stdio: 'ignore', windowsHide: true },
        ).unref()
        return
      }

      // Linux：默认不做“复制到桌面”，直接尝试执行（可按需扩展为复制到 Desktop 目录）
      if (process.platform === 'linux') {
        // 只在桌面放一个 .desktop，实际把可执行文件安装到用户目录（无需管理员权限）
        const homeDir = os.homedir()
        const installDir = join(homeDir, '.local', 'share', 'roxybrowser')
        const targetBinPath = join(installDir, 'roxybrowser')
        await mkdir(installDir, { recursive: true })
        await copyFile(sourceAppPath, targetBinPath)
        try {
          await chmod(targetBinPath, 0o755)
        }
        catch {
          /** ignore */
        }

        /** 尽力解析用户 Desktop 目录（支持 XDG user dirs），否则 fallback 到 ~/Desktop 或 ~/桌面 */
        async function getDesktopDir() {
          try {
            const userDirs = join(homeDir, '.config', 'user-dirs.dirs')
            if (await pathExists(userDirs)) {
              const content = await readFile(userDirs, 'utf8')
              const m = content.match(/^\s*XDG_DESKTOP_DIR\s*=\s*"(.*)"\s*$/m)
              if (m?.[1]) {
                const raw = m[1].replace(/\$HOME/g, homeDir)
                if (raw)
                  return raw
              }
            }
          }
          catch {
            /** ignore */
          }
          const desktopEn = join(homeDir, 'Desktop')
          const desktopZh = join(homeDir, '桌面')
          if (await pathExists(desktopEn))
            return desktopEn
          return desktopZh
        }

        const desktopDir = await getDesktopDir()
        const desktopEntryPath = join(desktopDir, 'Roxy Browser.desktop')
        const desktopEntry = [
          '[Desktop Entry]',
          'Type=Application',
          'Version=1.0',
          'Name=Roxy Browser',
          'Comment=Roxy Browser',
          // 桌面入口用于“正常打开应用”，不要带 --set-default-browser
          `Exec="${targetBinPath}"`,
          'Terminal=false',
          'Categories=Network;WebBrowser;',
          /** icon 可选：没有单独图标文件就先不写，避免路径无效 */
          '',
        ].join('\n')
        try {
          await mkdir(desktopDir, { recursive: true })
          await writeFile(desktopEntryPath, desktopEntry, 'utf8')
          await chmod(desktopEntryPath, 0o755)
        }
        catch {
          /** ignore: 桌面入口创建失败不影响后续注册逻辑 */
        }

        spawn(
          targetBinPath,
          ['--set-default-browser', `--roxy-default-browser-config-path=${appConfig.defaultBrowserConfig}`],
          { detached: true, stdio: 'ignore' },
        ).unref()
        /** done */
      }
    }
    catch (err) {
      console.error('[browser:setAsDefaultBrowser] failed:', err)
    }
  })

  /** 获取默认浏览器 */
  ipcMain.on('browser:getDefaultBrowser', (_event) => {
    return store.defaultBrowserDirId
  })
}
