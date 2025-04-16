import { ChildProcess, spawn } from "node:child_process";
import { appConfig } from "/@/constants";
import { Buffer } from "node:buffer";
import { defaultSyncSettings, preferenceSettings, SyncControlSettings, type PreferenceSettings } from "/@/modules/sync-control/model";
import { API } from "/@/api";
import { ipcMain } from '/@/modules/ipc'
import { browserManager } from "/@/modules/browser";
import { closeAllSyncDialogs, defaultMainControlWindowColor } from "/@/modules/sync-control/common";
import { createSynchronizerWindow } from "/@/modules/sync-control/synchronizer";
import { killProcessByName } from "/@/utils";

export type RoxySyncStartResult = { "listening": number, "monitors": [{ "height": number, "index": number, "width": number }] }

let roxySyncProcess: ChildProcess | null = null
/** 拉起同步器结果 */
let roxySyncStartResult = {} as RoxySyncStartResult
/** 所有当前同步窗口的进程 ID 数组 */
let syncWindowPIds: number[] = []
/** 主控窗口进程 ID, 第一个PID做为主窗口 */
let mainControlPId: number | null = null
/** 同步偏好设置 */
let syncControlSettings = {
  ...defaultSyncSettings,
}

/** 修改 roxy-sync 设置 */
export function updateSyncControlSettings(settings: SyncControlSettings) {
  Object.assign(syncControlSettings, settings)
}

/** 当前同步窗口的个数 */
export function getSyncWindowCount() {
  return syncWindowPIds.length
}

/** 获取同步器启动结果 */
export function getRoxySyncStartResult() {
  return roxySyncStartResult
}

export function getRoxySyncAPIBaseURL() {
  return `http://127.0.0.1:${roxySyncStartResult.listening}`
}

export async function startRoxySync(pIds: number[] = []) {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const syncSettings: SyncControlSettings = {
    ...defaultSyncSettings,
  }

  // 获取用户配置
  const { code, data } = await API.base.userGetUserConfigList()
  const remotePreferenceSettings = data.preferenceSettings as PreferenceSettings

  if (code === 0 && remotePreferenceSettings?.simulate) {
    const { enableClickDelay, enableInputDelay } = remotePreferenceSettings.simulate

    // 是否启用了点击延迟
    if (!enableClickDelay) {
      remotePreferenceSettings.simulate.clickIntervalMinMs = 0
      remotePreferenceSettings.simulate.clickIntervalMaxMs = 0
    }


    // 是否启用了输入延迟
    if (!enableInputDelay) {
      remotePreferenceSettings.simulate.inputIntervalMinMs = 0
      remotePreferenceSettings.simulate.inputIntervalMaxMs = 0
    }

    Object.assign(syncSettings, {
      ...remotePreferenceSettings.base,
      ...remotePreferenceSettings.simulate,
    })
    syncControlSettings = { ...syncSettings }
  }
  console.log('startRoxySync syncSettings:', syncSettings)
  // 1. 启动同步
  // 命令：
  // roxysync.exe --pids=pid1,pid2,pid3...  --settings=base64(settings结构)
  const startArgs = [
    `--pids=${pIds.join(',')}`,
    `--settings=${Buffer.from(JSON.stringify(syncSettings)).toString('base64')}`,
  ]
  console.log('startRoxySync startArgs:', startArgs)

  if (startArgs.length === 0) {
    console.log('startRoxySync startArgs is empty')
    resolve(false)
    return
  }

  roxySyncProcess = spawn(appConfig.roxySyncBinPath, startArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  roxySyncProcess.on('exit', (code) => {
    console.log(`roxy-sync exited with code ${code}`)
  })

  roxySyncProcess.on('error', (error) => {
    console.error('roxy-sync error:', error)
  })

  // 监听 stdout 数据事件
  roxySyncProcess.stdout?.on('data', (data) => {
    console.log(`roxySyncProcess stdout: ${data}`)
  })

  // 监听 stderr 数据事件
  roxySyncProcess.stderr?.on('data', (data) => {
    console.error(`roxySyncProcess stderr: ${data}`)
    if (data.includes('start success:')) {
      try {
        roxySyncStartResult = JSON.parse(data.toString().replace('start success:', ''))
        console.log('roxySync Start Result:', roxySyncStartResult)
        syncWindowPIds = pIds
        // 第一个PID为主窗口
        mainControlPId = pIds[0]
        setMainControlColor(syncControlSettings.mainControlWindowColor)
        resolve(true)
        const browser = getMainControlBrowser()
        Reflect.set(browser!, 'disconnectedListener', () => {
          console.log('主控浏览器关闭，停止同步')
          closeAllSyncDialogs()
          createSynchronizerWindow()
          stopRoxySync()
        })
        browser?.getBrowser()?.on('disconnected', Reflect.get(browser!, 'disconnectedListener'))
      } catch (error) {
        console.error('roxySync Start Result parse error:', error)
        resolve(false)
      }
    } else {
      resolve(false)
    }
  })

  // 6s 超时
  setTimeout(() => {
    resolve(false)
  }, 6000)

  return promise
}

/** 关闭非主控窗口时，移除 pid */
export function removeSyncWindowByPid(pIds: number) {
  syncWindowPIds = syncWindowPIds.filter(pid => pid !== pIds)
  ipcMain.send('syncControl:syncWindowCountChange', getSyncWindowCount())
}

export function stopRoxySync() {
  console.log('stopRoxySync')
  const browser = getMainControlBrowser()
  browser?.getBrowser()?.off('disconnected', Reflect.get(browser!, 'disconnectedListener'))
  // 停止同步的时候，主窗口主题颜色要恢复
  setMainControlColor(defaultMainControlWindowColor)
  closeAllSyncDialogs()
  syncWindowPIds = []
  if (roxySyncProcess) {
    roxySyncProcess.kill()
    roxySyncProcess = null
    roxySyncStartResult = {} as RoxySyncStartResult
  }
  killProcessByName('roxysync.exe')
}

/** 获取主控浏览器 */
export function getMainControlBrowser() {
  const allSyncControlBrowsers = getAllSyncControlBrowsers()
  const mainControlBrowser = allSyncControlBrowsers.find(item => item.launchInfo?.pid === mainControlPId)
  if (!mainControlBrowser) {
    console.error('主控浏览器不存在', mainControlPId)
  }
  return mainControlBrowser
}

/** 获取主控浏览器大小 */
export async function getMainControlBrowserSize() {
  const page = await getMainControlBrowser()?.getBrowser()?.pages()
  return page?.[0]?.evaluate(() => {
    return {
      width: window.outerWidth,
      height: window.outerHeight,
    };
  })
}

/** 获取所有被控浏览器 */
export function getControlledBrowsers() {
  const allSyncControlBrowsers = getAllSyncControlBrowsers()
  return allSyncControlBrowsers.filter(item => mainControlPId !== item.launchInfo?.pid)
}

/** 获取所有群控中的浏览器 */
export function getAllSyncControlBrowsers() {
  return [...browserManager.openedBrowserMap.values()].filter(item => {
    return item.launchInfo?.pid && syncWindowPIds.includes(item.launchInfo?.pid)
  })
}

/** 设置主控窗口颜色 */
export async function setMainControlColor(color = syncControlSettings.mainControlWindowColor) {
  const mainControlWindowColor = color.split('#').at(-1)!
  console.log('mainControlWindowColor', mainControlWindowColor)
  const rgb = mainControlWindowColor === defaultMainControlWindowColor ? '' : mainControlWindowColor.slice(-2) + mainControlWindowColor.slice(0, -2)
  console.log('设置主控窗口颜色', rgb)
  // 设置主窗口颜色： await cdpSesssion.send('Browser.setColor',{rgb:"FFFF6347"});
  // 还原背景颜色： await cdpSesssion.send('Browser.setColor',{rgb:""});
  const mainWindow = getMainControlBrowser()
  if (mainWindow) {
    const cdpSession = await mainWindow.getBrowser()?.target().createCDPSession()
    console.log('setMainControlColor cdpSession:', cdpSession)
    await cdpSession?.send('Browser.setColor', { rgb }).catch((err) => {
      console.error('设置主控窗口颜色失败', err)
    })
    console.log('设置主控窗口颜色成功', rgb)
  } else {
    mainControlPId && console.error('主控窗口不存在', mainControlPId)
  }
}
