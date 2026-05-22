import { app, autoUpdater, globalShortcut, shell } from 'electron'
import { spawn } from 'node:child_process'
import path, { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { appProtocolName } from '/@/constants'
import { isPackaged, isWindows } from '/@/constants/common'
import { checkResource } from '/@/modules/app/checkResource'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { cleanupAndExit, killAllBrowserProcess, showUninstallFeedback } from '/@/modules/app/utils'
import { openBrowserWindow } from '/@/modules/appServer/ws'
import { browserManager, coreManager } from '/@/modules/browser'
import { ipcSender } from '/@/modules/ipc/sender'
import { forceSaveConfig, initStorePromise, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { isWebReady, killProcessForce } from '/@/utils'
import { closeAllWindows } from '/@/utils/browser-window'
import { getMainWindow, intoMainPage, restoreOrCreateWindow } from './mainWindow'
import { proxyManager } from './proxy-manager'

// 获取 GPU 信息
// app.getGPUFeatureStatus()

// 开发环境下，使用开发环境变量中的版本号
if (!app.isPackaged) {
  app.getVersion = () => import.meta.env.VITE_APP_VERSION
}

// 设置主进程调试端口
// app.commandLine.appendSwitch('inspect', '9229');
// 设置渲染进程远程调试端口
// app.commandLine.appendSwitch('remote-debugging-port', '8315');
app.commandLine.appendSwitch('experimental-network-inspection')
app.commandLine.appendSwitch('disable-renderer-accessibility')
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=3072')
app.commandLine.appendSwitch('no-sandbox')
// 开发环境忽略 localhost 连接数限制
!isPackaged && app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')

// macOS 的行为不同：当应用通过协议被启动时，系统不会把参数放在 process.argv，而是触发 open-url 事件，必须在 ready 之前监听
app.on('open-url', (event, url) => {
  console.log('open-url', url)
  event?.preventDefault?.()
  dispatchDeepLink(url, 'open-url')
})

function getRoxyActionFromArgs(args: readonly string[]) {
  const eq = args.find(a => a.startsWith('--roxy-action='))
  if (eq)
    return eq.split('=')[1]

  const idx = args.findIndex(a => a === '--roxy-action')
  if (idx !== -1)
    return args[idx + 1]

  return undefined
}

export async function dispatchRoxyAction(argv: readonly string[], source: 'second-instance' | 'cold-start' | 'dock-menu') {
  try {
    await initStorePromise.promise
    const { values } = parseArgs({
      args: argv,
      options: {
        'roxy-action': { type: 'string' },
        'dir-id': { type: 'string' },
        'workspace-id': { type: 'string' },
      },
      strict: false,
      allowPositionals: true,
    })

    const action = values['roxy-action']
    console.log(`roxy-action [${source}]:`, action, values)

    if (action === 'launch-browser') {
      const dirId = values['dir-id']
      const workspaceId = values['workspace-id']
      if (typeof dirId === 'string' && dirId && typeof workspaceId === 'string' && workspaceId) {
        const wid = Number(workspaceId)
        if (Number.isFinite(wid) && wid > 0) {
          openBrowserWindow(dirId, wid)
        }
        else {
          console.debug('launch-browser: workspace-id is not valid', { dirId, workspaceId, argv })
        }
      }
      else {
        console.debug('launch-browser: params is not valid', { dirId, workspaceId, argv })
      }
    }
  }
  catch (error) {
    console.error('Failed to dispatch roxy-action:', source, argv, error)
  }
}

export async function setupApp() {
  app.removeAsDefaultProtocolClient(appProtocolName)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(appProtocolName, process.execPath, [path.resolve(process.argv[1])])
    }
  }
  else {
    app.setAsDefaultProtocolClient(appProtocolName)
  }

  app.on('second-instance', async (event, commandLine) => {
    console.log('commandLine', commandLine)

    // 卸载反馈由“卸载模式独立进程”处理。这里直接忽略，避免主实例抢焦点/重复弹窗。
    if (commandLine.includes('--uninstall-feedback')) {
      console.log('second-instance: uninstall-feedback')
      setTimeout(() => {
        showUninstallFeedback()
      }, 100)
      return
    }

    await restoreOrCreateWindow()

    // 优先处理 deep link（可能出现在任意 argv）
    const deepLink = commandLine.find(arg => arg.startsWith(`${appProtocolName}://`)) || ''
    if (deepLink) {
      await dispatchDeepLink(deepLink, 'second-instance')
      return
    }

    // 再处理任务栏/JumpList 的 action
    const action = getRoxyActionFromArgs(commandLine)
    if (action) {
      await dispatchRoxyAction(commandLine, 'second-instance')
    }
  })

  //  系统自带浏览器打开
  app.on('web-contents-created', (e, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  /**
   * Shout down background process if all windows was closed
   */
  // app.on('window-all-closed', () => {
  //   if (process.platform !== 'darwin') {
  //     console.log('All windows was closed. Quit app.')
  //     app.quit()
  //   }
  // })

  /**
   * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
   */
  app.on('activate', () => {
    console.debug('App activate event')
    if (!isUninstallFeedbackMode) {
      restoreOrCreateWindow()
    }
  })

  /**
   * Create app window when background process will be ready
   */
  try {
    await app.whenReady()

    // 设置默认代理配置
    await proxyManager.enableDefaultProxy()
    // 启动系统代理监听器
    proxyManager.startSystemProxyWatcher()

    // 临时减少崩溃的问题：https://github.com/electron/electron/issues/39574
    app.setAccessibilitySupportEnabled(false)
    // 检查资源是否准备完毕
    await checkResource()
    // 进入主页
    await intoMainPage()
    // 处理冷启动
    await handleColdStart()

    console.log('setupApp done')
    // 初始化应用程序事件
    initAppEvent()
    // showUninstallFeedback()
  }
  catch (error) {
    console.error('Failed create window:', error)
  }
}

/** 是否由 autoUpdater.quitAndInstal() 退出应用程序 */
let isQuittingForUpdate = false
/** APP 是否处于退出中 */
let $$isAppQuitting = false

export function isAppQuittingForUpdate() {
  return isQuittingForUpdate
}

export function isAppQuitting() {
  return $$isAppQuitting
}

export function resetAppQuittingForUpdate() {
  isQuittingForUpdate = false
}

/** 初始化应用程序事件 */
function initAppEvent() {
  /** 是否已经在 APP 退出前同步过浏览器数据了 */
  let isSyncBrowserData = false

  autoUpdater.on('before-quit-for-update', () => {
    isQuittingForUpdate = true
    console.log('Application is quitting for update.')
  })

  // autoUpdater.on('error', (error) => {
  //   console.log('[autoUpdater] error', error)
  // })

  /**
   * 是否有一次 before-quit 的清理流程正在进行中
   *
   * 用于防止在 macOS 上, 用户连点 Cmd+Q / Dock Quit / 托盘"退出" 时
   * 同时进入多次 before-quit, 重入触发 browserManager.closeAll() 同步任务,
   * 造成数据被截断或重复落盘.
   */
  let isCleanupInFlight = false

  app.on('before-quit', async (event) => {
    $$isAppQuitting = true
    if (store.defaultBrowserLauncherPid) {
      killProcessForce(store.defaultBrowserLauncherPid)
    }

    // 第二次 (或更多次) 进入 before-quit:
    // - isSyncBrowserData=true && !isCleanupInFlight: 之前已经清理完, 这里直接放行让 Electron 完成 quit 生命周期
    // - isCleanupInFlight: 上一次还在异步同步中, 阻止当前默认退出, 等上次走完再驱动一次 app.quit()
    if (isSyncBrowserData) {
      if (isCleanupInFlight) {
        console.log('before-quit re-entered while cleanup in flight, prevent default and wait')
        event.preventDefault()
      }
      // 仅在升级路径下需要追加保存 + spawn updater 的逻辑
      if (isQuittingForUpdate && !isCleanupInFlight) {
        store.appNormalExit = true
        await forceSaveConfig()
        console.log('Application is finally quitting to allow Updater to install. Bypassing cleanupAndExit.')
        // 让 Electron 正常完成退出生命周期, 确保 ShipIt 或其它提权更新服务不会被 SIGKILL 所谋杀
      }
      return
    }

    // 首次进入 before-quit: 拦下默认退出, 走异步清理
    event.preventDefault()
    isCleanupInFlight = true

    try {
      try {
        closeAllWindows()
        // 关闭所有浏览器进程，并同步数据
        await browserManager.closeAll()
        console.log('Application is quitting normally.')
      }
      catch (error) {
        console.error('browserManager.closeAll error:', error)
      }
      finally {
        console.log('Application is quitting finally.')
        globalShortcut.unregisterAll()
        // 退出所有浏览器进程, 防止有漏网之鱼;
        // macOS / Linux 上不再依赖后续 SIGKILL 兜底, 必须 await 等清理完再走 app.quit().
        await killAllBrowserProcess()
      }

      await coreManager.cleanOldCore()

      // 由 APP 升级触发的退出
      if (isQuittingForUpdate) {
        console.log('Application is quitting for update. Triggering upgradeNow()')
        isSyncBrowserData = true
        if (isWindows) {
          try {
            if (store.updaterExePid) {
              killProcessForce(store.updaterExePid)
            }
            // 构造 updaterExe 路径并脱离主进程执行
            const updaterExe = join(dirname(process.execPath), 'RoxyBrowserUpdater.exe')
            console.log('Spawning updater detached:', updaterExe)

            const child = spawn(updaterExe, [], {
              detached: true,
              stdio: 'ignore',
            })
            store.updaterExePid = child.pid
            console.log('[AppUpdater] updaterExePid', store.updaterExePid)
            child.unref()
          }
          catch (e) {
            console.error(`[AppUpdater] Failed to spawn updater UI`, e)
          }
        }
        store.appNormalExit = true
        await forceSaveConfig()
        appUpdater.upgradeNow()
      }
      else {
        isSyncBrowserData = true
        store.appNormalExit = true
        await forceSaveConfig()
        cleanupAndExit()

        // macOS / Linux: cleanupAndExit 在非 Windows 下不再 SIGKILL/app.exit,
        // 这里需要再次显式触发 app.quit() 让 Electron 走完正常的 quit 生命周期,
        // 否则被 event.preventDefault() 拦下的退出永远不会真正发生 (尤其会导致 app.relaunch() 失效).
        if (!isWindows) {
          // 异步触发, 让当前 before-quit handler 先返回, 再进入下一轮 before-quit 走"已清理"分支
          setImmediate(() => app.quit())
        }
      }
    }
    finally {
      isCleanupInFlight = false
    }
  })
}

async function handleColdStart() {
  // 冷启动通过自定义协议唤起时，从 argv 中获取参数
  // 注意：macOS 在应用未启动时通过自定义协议拉起应用，不会触发 open-url 事件
  // 而是会将协议 URL 作为启动参数传递，因此这里也需要处理 macOS 的情况
  try {
    await initStorePromise.promise
    const startupUrl = process.argv.find(arg => arg.startsWith(`${appProtocolName}://`))
    if (startupUrl) {
      await dispatchDeepLink(startupUrl, 'cold-start')
      return
    }

    const action = getRoxyActionFromArgs(process.argv)
    if (action) {
      await dispatchRoxyAction(process.argv, 'cold-start')
    }
  }
  catch (error) {
    console.error('Failed to handle protocol on cold start:', error)
  }
}

/**
 * 统一处理自定义协议（deep link）的分发逻辑。
 *
 * 用途：
 * - 在三种入口调用：冷启动（cold-start）、macOS 的 open-url、Windows/Linux 的 second-instance。
 * - 根据 URL 路径将参数分发到对应的渲染进程 IPC 通道。
 *
 * 行为：
 * - 非法或不以 `${appProtocolName}://` 开头的 URL 将被忽略。
 * - 内部会等待渲染端就绪（isWebReady）再发送消息，避免丢包。
 * - 当前支持的路由：oauth2callback / inviteUser2project / open-page。
 *
 * @param url 形如 `${appProtocolName}://path?query` 的完整链接
 * @param source 触发来源标识（'second-instance' | 'open-url' | 'cold-start'），用于日志排查
 */
async function dispatchDeepLink(url: string, source: 'second-instance' | 'open-url' | 'cold-start') {
  try {
    if (!url || !url.startsWith(`${appProtocolName}://`))
      return

    await initStorePromise.promise
    console.log(`deep-link [${source}]:`, url)
    const queryString = url.split('?')[1]
    const searchParams = Object.fromEntries(new URLSearchParams(`?${queryString}`))
    await isWebReady()
    if (url.includes(`${appProtocolName}://oauth2callback`)) {
      ipcSender.oauth2.googleCallback(`?${queryString}`)
      console.log('oauth2callback:', source, url)
    }
    if (url.includes(`${appProtocolName}://inviteUser2project`)) {
      ipcSender.invite.toProject(`?${queryString}`)
      console.log('inviteUser2project:', source, url)
    }
    if (url.includes(`${appProtocolName}://open-page`)) {
      ipcSender.open.page(`?${queryString}`)
      console.log('open-page:', source, url)
    }
    // 通过外部打开浏览器失败错误弹窗（默认浏览器中转器兜底入口）
    if (url.includes(`${appProtocolName}://open-browser-failed`)) {
      console.log('dialog:open-browser-failed:', searchParams)
      const { dirId, workspaceId, url: targetUrl } = searchParams as any
      if (dirId && workspaceId) {
        const wid = Number(workspaceId)
        if (targetUrl) {
          console.log('dialog:open-browser-failed: resolved url', { dirId, workspaceId: wid, targetUrl })
          openBrowserWindow(dirId, wid, [String(targetUrl)])
        }
        else {
          openBrowserWindow(dirId, wid)
        }
      }
      else {
        console.debug('open-browser-failed: params is not valid', searchParams)
      }
    }
    getMainWindow()?.show?.()
  }
  catch (error) {
    console.error('Failed to dispatch deep link:', source, error)
  }
}
