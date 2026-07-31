import type { ChildProcess } from 'node:child_process'
import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path, { join, normalize } from 'node:path'
import { appConfig } from '/@/constants'
import { defaultBrowserExeName, defaultFirefoxExeName, isDev } from '/@/constants/common'
import { shortcutStore } from '/@/modules/shortcut-manager/ShortcutStore'
import { store } from '/@/modules/store'
import { resourceUpdater } from '/@/modules/updater'
import { fileExists } from '/@/utils'

function spawnWait(command: string, args: string[], options: Parameters<typeof spawn>[2] = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options as any) as unknown as ChildProcess
    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (d) => {
        stdout += d.toString()
      })
    }
    if (child.stderr) {
      child.stderr.on('data', (d) => {
        stderr += d.toString()
      })
    }

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(
          [
            `[spawnWait] ${command} exited with code=${code} signal=${signal ?? ''}`.trim(),
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
          ].filter(Boolean).join('\n'),
        ))
      }
    })
  })
}

function escapeForSingleQuotes(s: string) {
  // for shell script string wrapped by single quotes
  return s.replace(/'/g, `'\"'\"'`)
}

function sanitizeDesktopId(name: string) {
  // .desktop filename/id should be stable and avoid problematic chars
  return (name || 'app')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'app'
}

const WINDOWS_RESERVED_FILE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

/** 根据内核类型返回快捷方式文件名 fallback */
function getShortcutNameFallback(coreType?: string): string {
  return coreType === 'Firefox' ? defaultFirefoxExeName : defaultBrowserExeName
}

function stripControlChars(input: string): string {
  return input.split('').filter(ch => ch.charCodeAt(0) >= 0x20).join('')
}

/**
 * 将窗口名转为安全的快捷方式文件名（不含扩展名）。
 * 展示文案仍应使用原始 execName，避免路径分隔符/Windows 非法字符导致 .lnk 创建失败。
 */
function sanitizeShortcutFileName(name: string, fallback: string): string {
  let sanitized = stripControlChars(name || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()

  while (/[. ]$/.test(sanitized)) {
    sanitized = sanitized.replace(/[. ]+$/, '')
  }

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = fallback
  }

  if (WINDOWS_RESERVED_FILE_NAMES.has(sanitized.toUpperCase())) {
    sanitized = `${sanitized}_`
  }

  if (sanitized.length > 120) {
    sanitized = sanitized.slice(0, 120).replace(/[. ]+$/, '')
  }

  return sanitized || fallback
}

/** 分离快捷方式磁盘文件名与 UI 展示名 */
function resolveShortcutNames(execName: string, fallback: string) {
  const displayName = (execName || '').trim() || fallback
  const shortcutFileName = sanitizeShortcutFileName(displayName, fallback)
  return { displayName, shortcutFileName }
}

/** 设为默认浏览器时写入 store，供 Tauri launcher 读取 config.json */
function persistDefaultBrowserSelection(dirId: string, workspaceId: number) {
  store.defaultBrowserDirId = dirId
  store.defaultBrowserWorkspaceId = workspaceId
}

const defaultBrowserBinDir = join(appConfig.sessionDir, 'default-browser-bin')

interface InstallAndRegisterOptions {
  dirId: string
  workspaceId: number
  execName: string
  /** 是否设为默认浏览器 */
  isSetAsDefaultBrowser?: boolean
  /** 浏览器内核类型，Chrome 或 Firefox，缺省按 Chrome 处理 */
  coreType?: string
}

/**
 * 根据内核类型和平台返回启动器可执行文件路径
 * - Chrome：default-browser-bin/RoxyChrome.{ext}
 * - Firefox：firefox-bin/RoxyFirefox.{ext}
 */
function getSourceAppPath(coreType?: string): string {
  const isFirefox = coreType === 'Firefox'
  const exeName = isFirefox ? defaultFirefoxExeName : defaultBrowserExeName
  return {
    darwin: join(defaultBrowserBinDir, `${exeName}.app`),
    win32: join(defaultBrowserBinDir, `${exeName}.exe`),
    linux: join(defaultBrowserBinDir, `${exeName}.AppImage`),
  }[process.platform] ?? join(defaultBrowserBinDir, exeName)
}

/**
 * 返回 macOS / Linux 快捷方式图标路径（.icns 或 .png）
 * Firefox 使用 resources/firefox/ 下的专属图标，Chrome 使用通用 launcher 图标。
 */
function getLauncherIconPath(coreType: string | undefined, ext: 'icns' | 'png' | 'ico'): string {
  const resourcesDir = path.join(import.meta.dirname, '..', 'resources')
  if (coreType === 'Firefox') {
    return path.join(resourcesDir, 'firefox', `icon.${ext}`)
  }
  // Chrome 保持原有命名规则
  if (ext === 'icns' || ext === 'ico') {
    return path.join(resourcesDir, `launcher.${ext}`)
  }
  return path.join(resourcesDir, 'launcher.png')
}

export class DefaultBrowserInstaller {
  /**
   * macOS：通过 AppleScript applet 触发管理员授权。
   *
   * 说明：
   * - 系统弹窗文案无法完全自定义，“想要进行更改”等是固定的；
   * - 但弹窗里显示的“发起者名称”来自发起授权的 App（这里用临时编译出来的 applet），
   *   这样就不会显示为 `osascript`。
   */
  private async runPrivilegedMacCopyWithApplet(options: {
    sourceAppPath: string
    targetAppPath: string
    displayName: string
  }) {
    const { sourceAppPath, targetAppPath, displayName } = options

    const sourceEsc = escapeForSingleQuotes(sourceAppPath)
    const targetEsc = escapeForSingleQuotes(targetAppPath)

    const scriptPath = path.join(os.tmpdir(), `roxy_privileged_copy_${Date.now()}.scpt`)
    const appletPath = path.join(os.tmpdir(), `${displayName}.app`)

    // 生成脚本：在管理员权限下复制到 /Applications
    await writeFile(
      scriptPath,
      `do shell script "rm -rf '${targetEsc}' && ditto '${sourceEsc}' '${targetEsc}'" with administrator privileges`,
    )

    // osacompile -o 需要目标 app 路径不存在
    await rm(appletPath, { recursive: true, force: true })
    await spawnWait('osacompile', ['-o', appletPath, scriptPath])

    // 设置图标（用于系统授权弹窗展示）
    const iconPath = path.join(import.meta.dirname, '..', 'resources/launcher.icns')
    await cp(iconPath, path.join(appletPath, 'Contents/Resources/applet.icns')).catch(() => undefined)
    await cp(iconPath, path.join(appletPath, 'Contents/Resources/droplet.icns')).catch(() => undefined)
    await rm(path.join(appletPath, 'Contents/Resources/Assets.car')).catch(() => undefined)

    // 重新签名 app（ad-hoc 签名）
    await spawnWait('codesign', [
      '--force',
      '--deep',
      '-s',
      '-',
      appletPath,
    ])

    // 运行 applet，并等待其退出（这样能同步拿到复制完成的时机）
    await spawnWait('open', ['-W', '-n', appletPath], { stdio: 'inherit' })

    // 清理临时文件（失败不影响主流程）
    await rm(scriptPath, { force: true }).catch(() => undefined)
    await rm(appletPath, { recursive: true, force: true }).catch(() => undefined)
  }

  async installAndRegister(options: InstallAndRegisterOptions) {
    const sourceAppPath = getSourceAppPath(options.coreType)
    if (!(await fileExists(sourceAppPath))) {
      console.error(`[browser:setAsDefaultBrowser] source app path not found: ${sourceAppPath}`)
      await resourceUpdater.checkForUpdates()
      if (!(await fileExists(sourceAppPath))) {
        console.debug(`[browser:setAsDefaultBrowser] checkForUpdates failed`)
        throw new Error(`[browser:setAsDefaultBrowser] checkForUpdates failed`)
      }
    }

    if (process.platform === 'darwin') {
      await this.installAndRegisterOnMac(options)
    }
    else if (process.platform === 'win32') {
      await this.installAndRegisterOnWindows(options)
    }
    else if (process.platform === 'linux') {
      await this.installAndRegisterOnLinux(options)
    }
    else {
      throw new Error(`[browser:setAsDefaultBrowser] unsupported platform: ${process.platform}`)
    }
  }

  async installAndRegisterOnWindows(options: InstallAndRegisterOptions) {
    const { dirId, workspaceId, execName, isSetAsDefaultBrowser, coreType } = options

    if (isSetAsDefaultBrowser) {
      persistDefaultBrowserSelection(dirId, workspaceId)
    }

    // 在桌面创建快捷方式（.lnk）
    try {
      const sourceAppPath = getSourceAppPath(coreType)
      const fallback = getShortcutNameFallback(coreType)
      const { displayName, shortcutFileName } = resolveShortcutNames(execName, fallback)
      // Firefox 使用专属 .ico 图标；Chrome 使用通用 launcher.ico（若存在）
      const iconPath = getLauncherIconPath(coreType, 'ico')

      const desktopShortcutPath = path.join(app.getPath('desktop'), `${shortcutFileName}.lnk`)

      // Windows 开始菜单「所有应用」入口：
      // 把 .lnk 写到：%APPDATA%\Microsoft\Windows\Start Menu\Programs\<AppName>\xxx.lnk
      // 注意：这只能让应用出现在「所有应用」，无法稳定实现“固定到开始菜单/任务栏”。
      const startMenuDir = path.join(
        app.getPath('appData'),
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        app.getName(),
      )
      const startMenuShortcutPath = path.join(startMenuDir, `${shortcutFileName}.lnk`)

      const oldShortcutItem = await shortcutStore.get(dirId)

      // 如果该窗口已经存在快捷方式，但是路径不一致，则删除旧的快捷方式
      if (oldShortcutItem?.launcherEntry && oldShortcutItem.launcherEntry !== desktopShortcutPath) {
        console.debug('delete old shortcut', oldShortcutItem.launcherEntry)
        await rm(normalize(oldShortcutItem.launcherEntry), { recursive: true, force: true }).catch((e) => {
          console.error('delete old shortcut failed', e)
        })
      }

      // 如果该窗口已经存在开始菜单快捷方式，但是路径不一致，则删除旧的快捷方式
      if (oldShortcutItem?.startMenuEntry && oldShortcutItem.startMenuEntry !== startMenuShortcutPath) {
        await rm(normalize(oldShortcutItem.startMenuEntry), { recursive: true, force: true }).catch(() => undefined)
      }

      const args = `--dir-id=${dirId} --workspace-id=${workspaceId}`
      // 仅在图标文件实际存在时才写入 icon 字段，避免快捷方式显示错误图标
      const iconExists = await fileExists(iconPath)
      const shortcutIcon = iconExists ? iconPath : undefined

      const isDesktopSuccess = shell.writeShortcutLink(desktopShortcutPath, {
        target: sourceAppPath,
        args,
        description: displayName,
        ...(shortcutIcon ? { icon: shortcutIcon } : {}),
      })

      // 开始菜单：确保目录存在，再写入 .lnk（失败不影响主流程）
      await mkdir(startMenuDir, { recursive: true }).catch(() => undefined)
      shell.writeShortcutLink(startMenuShortcutPath, {
        target: sourceAppPath,
        args,
        description: displayName,
        ...(shortcutIcon ? { icon: shortcutIcon } : {}),
      })

      if (isDesktopSuccess) {
        await shortcutStore.set(dirId, {
          // 仍以桌面快捷方式为主路径存储，便于旧逻辑清理/兼容
          launcherEntry: desktopShortcutPath,
          startMenuEntry: startMenuShortcutPath,
          program: sourceAppPath,
          arguments: args,
          title: displayName,
        })
      }
      else {
        console.error(
          `[browser:setAsDefaultBrowser] create shortcut failed: displayName=${displayName} desktop=${desktopShortcutPath} startMenu=${startMenuShortcutPath}`,
        )
      }
    }
    catch (error) {
      console.error('[browser:setAsDefaultBrowser] create windows shortcut failed', error)
    }

    if (options.isSetAsDefaultBrowser) {
      const sourceAppPath = getSourceAppPath(options.coreType)
      spawn(
        sourceAppPath,
        ['--set-default-browser'],
        { detached: true, stdio: 'ignore', windowsHide: true },
      ).unref()
    }
  }

  /**
   * macOS：复制 bundle 到 /Applications（需要管理员权限），然后调用 --set-default-browser
   */
  async installAndRegisterOnMac(options: InstallAndRegisterOptions) {
    const { dirId, workspaceId, execName, isSetAsDefaultBrowser, coreType } = options
    const sourceAppPath = getSourceAppPath(coreType)
    const isFirefox = coreType === 'Firefox'
    const exeName = isFirefox ? defaultFirefoxExeName : defaultBrowserExeName
    const fallback = getShortcutNameFallback(coreType)
    const { displayName, shortcutFileName } = resolveShortcutNames(execName, fallback)
    const targetAppPath = `/Applications/${exeName}.app`
    const targetAppBinPath = `/Applications/${exeName}.app/Contents/MacOS/${exeName}`

    if (isSetAsDefaultBrowser) {
      // 通过 applet 触发管理员授权，弹窗将显示该 applet 的名称（而不是 osascript）
      await this.runPrivilegedMacCopyWithApplet({
        sourceAppPath,
        targetAppPath,
        // 使用固定名称以匹配期望的系统弹窗展示（系统后半句文案无法自定义）
        displayName: isFirefox ? 'RoxyFirefox' : 'RoxyBrowser',
      })
      spawn(
        targetAppBinPath,
        ['--set-default-browser'],
        { detached: true, stdio: 'ignore' },
      ).unref()
      persistDefaultBrowserSelection(dirId, workspaceId)
    }

    const args = `--dir-id=${dirId} --workspace-id=${workspaceId}`

    const scriptPath = path.join(os.tmpdir(), isFirefox ? 'launch_roxy_firefox.scpt' : 'launch_roxy_chrome.scpt')
    const appOutPath = path.join(
      os.homedir(),
      'Applications',
      $t('{appName} 应用', { appName: `RoxyBrowser${isDev ? 'Dev' : ''}` }),
      `${shortcutFileName}.app`,
    )

    const oldShortcutItem = await shortcutStore.get(dirId)

    // 如果该窗口已经存在快捷方式，但是路径不一致，则删除旧的快捷方式
    if (oldShortcutItem?.launcherEntry && oldShortcutItem.launcherEntry !== appOutPath) {
      console.debug('delete old shortcut', oldShortcutItem.launcherEntry)
      // macOS 的 .app 是目录包，需要 recursive；force 避免不存在时报错
      await rm(normalize(oldShortcutItem.launcherEntry), { recursive: true, force: true }).catch((e) => {
        console.error('delete old shortcut failed', e)
      })
    }

    await shortcutStore.set(dirId, {
      launcherEntry: appOutPath,
      program: sourceAppPath,
      arguments: args,
      title: displayName,
    })

    await writeFile(
      scriptPath,
      // macOS: `open <app>` 在 App 已运行时通常只会激活已有实例，不会把新的 --args 传给进程；
      // 使用 `-n` 强制启动新实例，`-a` 允许传入 .app 路径。
      `do shell script "open -na '${sourceAppPath}' --args ${args}"`,
    )
    console.debug('scriptPath', scriptPath)
    console.debug('appOutPath', appOutPath)
    // 注意：osacompile -o 需要目标 app 路径不存在；提前 mkdir(<xxx>.app) 会导致 osacompile 直接失败
    await mkdir(path.dirname(appOutPath), { recursive: true })
    await rm(appOutPath, { recursive: true, force: true })
    await spawnWait('osacompile', [
      '-o',
      appOutPath,
      scriptPath,
    ])

    const iconPath = getLauncherIconPath(coreType, 'icns')
    await cp(iconPath, path.join(appOutPath, 'Contents/Resources/applet.icns'))
    await cp(iconPath, path.join(appOutPath, 'Contents/Resources/droplet.icns'))
    await rm(path.join(appOutPath, 'Contents/Resources/Assets.car')).catch(() => undefined)
    // 重新签名 app（ad-hoc 签名）
    await spawnWait('codesign', [
      '--force',
      '--deep',
      '-s',
      '-',
      appOutPath,
    ])
  }

  async installAndRegisterOnLinux(options: InstallAndRegisterOptions) {
    const { dirId, workspaceId, execName, isSetAsDefaultBrowser, coreType } = options

    if (isSetAsDefaultBrowser) {
      persistDefaultBrowserSelection(dirId, workspaceId)
    }

    // 在桌面创建快捷方式（.desktop）
    try {
      const sourceAppPath = getSourceAppPath(coreType)
      const fallback = getShortcutNameFallback(coreType)
      const { displayName, shortcutFileName } = resolveShortcutNames(execName, fallback)

      // 确保可执行文件有执行权限（某些下载/解压场景可能丢失权限）
      await chmod(sourceAppPath, 0o755).catch(() => undefined)

      const shortcutPath = path.join(app.getPath('desktop'), `${shortcutFileName}.desktop`)

      const oldShortcutItem = await shortcutStore.get(dirId)
      // 如果该窗口已经存在快捷方式，但是路径不一致，则删除旧的快捷方式
      if (oldShortcutItem?.launcherEntry && oldShortcutItem.launcherEntry !== shortcutPath) {
        console.debug('delete old shortcut', oldShortcutItem.launcherEntry)
        await rm(normalize(oldShortcutItem.launcherEntry), { force: true }).catch((e) => {
          console.error('delete old shortcut failed', e)
        })
      }

      const args = `--dir-id=${dirId} --workspace-id=${workspaceId}`

      // Firefox 优先使用 resources/firefox/icon.png；Chrome 使用 default-browser-bin/launcher.png（兜底复制 staticResourceDir）
      let iconPath: string
      if (coreType === 'Firefox') {
        iconPath = getLauncherIconPath(coreType, 'png')
      }
      else {
        iconPath = path.join(defaultBrowserBinDir, 'launcher.png')
        if (!(await fileExists(iconPath))) {
          await cp(path.join(appConfig.staticResourceDir, 'launcher.png'), iconPath).catch(() => undefined)
        }
      }
      const iconLine = (await fileExists(iconPath)) ? `Icon=${iconPath}\n` : ''

      // 注意：Exec 行允许带参数；为了兼容空格路径，这里对可执行文件路径加双引号
      const escapedExecPath = sourceAppPath.replace(/"/g, '\\"')
      const desktopFileContent = `[Desktop Entry]
Type=Application
Name=${displayName}
Comment=${displayName}
    Exec="${escapedExecPath}" ${args} %U
    MimeType=x-scheme-handler/http;x-scheme-handler/https;text/html;application/xhtml+xml;
${iconLine}Terminal=false
Categories=Network;WebBrowser;
`

      // 桌面目录通常存在，但部分环境可能被用户移动/不存在；尽量保证不抛错影响后续逻辑
      await mkdir(path.dirname(shortcutPath), { recursive: true }).catch(() => undefined)
      await writeFile(shortcutPath, desktopFileContent, 'utf-8')
      await chmod(shortcutPath, 0o755).catch(() => undefined)

      // GNOME: 桌面上的 .desktop 需要显式标记 trusted，否则会提示 “Untrusted Desktop File”。
      // best-effort：失败不影响后续注册逻辑。
      await spawnWait('gio', ['set', shortcutPath, 'metadata::trusted', 'true']).catch(() => undefined)

      // 写入到 XDG applications 目录，供系统默认浏览器设置使用
      const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
      const applicationsDir = path.join(xdgDataHome, 'applications')
      const desktopId = `${sanitizeDesktopId(shortcutFileName)}-default.desktop`
      const systemDesktopPath = path.join(applicationsDir, desktopId)

      // 如果该窗口已经存在开始菜单快捷方式，但是路径不一致，则删除旧的快捷方式
      if (oldShortcutItem?.startMenuEntry && oldShortcutItem.startMenuEntry !== systemDesktopPath) {
        await rm(normalize(oldShortcutItem.startMenuEntry), { recursive: true, force: true }).catch((e) => {
          console.error('delete old shortcut failed', e)
        })
      }

      const systemDesktopContent = `[Desktop Entry]
Type=Application
Name=${displayName}
Comment=${displayName}
Exec="${escapedExecPath}" ${args} %U
MimeType=x-scheme-handler/http;x-scheme-handler/https;text/html;application/xhtml+xml;
${iconLine}Terminal=false
Categories=Network;WebBrowser;
`
      console.debug('systemDesktopPath', systemDesktopPath)
      await mkdir(applicationsDir, { recursive: true }).catch(() => undefined)
      await writeFile(systemDesktopPath, systemDesktopContent, 'utf-8').catch(() => undefined)
      await chmod(systemDesktopPath, 0o644).catch(() => undefined)
      await spawnWait('gio', ['set', systemDesktopPath, 'metadata::trusted', 'true']).catch(() => undefined)

      // 尽量触发系统刷新并设置默认浏览器（失败不影响主流程）
      await spawnWait('update-desktop-database', [applicationsDir]).catch(() => undefined)
      await spawnWait('xdg-settings', ['set', 'default-web-browser', desktopId]).catch(() => undefined)
      await spawnWait('xdg-mime', ['default', desktopId, 'x-scheme-handler/http']).catch(() => undefined)
      await spawnWait('xdg-mime', ['default', desktopId, 'x-scheme-handler/https']).catch(() => undefined)
      await spawnWait('xdg-mime', ['default', desktopId, 'text/html']).catch(() => undefined)
      await spawnWait('xdg-mime', ['default', desktopId, 'application/xhtml+xml']).catch(() => undefined)
      await spawnWait('gio', ['mime', 'x-scheme-handler/http', desktopId]).catch(() => undefined)
      await spawnWait('gio', ['mime', 'x-scheme-handler/https', desktopId]).catch(() => undefined)
      console.debug('shortcutPath', shortcutPath)

      await shortcutStore.set(dirId, {
        launcherEntry: shortcutPath,
        startMenuEntry: systemDesktopPath,
        program: sourceAppPath,
        arguments: args,
        title: displayName,
      })
    }
    catch (error) {
      // ignore: 创建快捷方式失败不影响后续注册逻辑
      console.error('[browser:setAsDefaultBrowser] create linux shortcut failed', error)
    }

    if (options.isSetAsDefaultBrowser) {
      const sourceAppPath = getSourceAppPath(options.coreType)
      spawn(
        sourceAppPath,
        ['--set-default-browser'],
        { detached: true, stdio: 'ignore' },
      ).unref()
    }
  }
}
