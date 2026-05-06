import type { IPCMainInstance } from '/@/modules/ipc/types'
import { genRandomFingerprint, genRandomFonts, randomFingerprintFuncMap } from '@roxy/shared'
import { app, globalShortcut } from 'electron'
import crypto from 'node:crypto'
import url from 'node:url'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { mediaProtocolName } from '/@/constants'
import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import { clearInstallerPath, decryptAESGCM, encryptAESGCM, fetchHiddenPageHtml, getCommonRequestHeaders, getDeviceId, getDeviceInfo, getInviteCode, getLocalFonts, getMacAddress, getUTCOffsetHours } from '/@/utils'

export function setupUtilIpc(ipcMain: IPCMainInstance) {
  /** 获取系统信息 */
  ipcMain.on('util:getSystemInfo', (event) => {
    return {
      language: app.getLocale(),
      UTCOffsetHours: getUTCOffsetHours(),
    }
  })

  /** 生成 api key */
  ipcMain.on('util:genApiKey', (event) => {
    return crypto.createHash('md5').update(String(Date.now()), 'utf8').digest('hex')
  })

  /** 将本地绝对路径转为自定义媒体协议路径 */
  ipcMain.on('util:toMediaPath', (event, pathname) => {
    return `${mediaProtocolName}:${pathname}`
  })

  /** 删除工作空间 */
  ipcMain.on('util:removeWorkspace', async (event, workspaceId) => {
    const result = await API.window.userGetWindowInfoV2List({ page_index: 1, page_size: 2000 }, { headers: { workspaceId } })

    if (result.code === 0) {
      const promiseArr = result.data.rows.map(winInfo => browserManager.removeLocalData(winInfo.dirId!))
      Promise.all(promiseArr).then((data) => {
        console.log('Workspace deleted successfully', data)
      }).catch((error) => {
        console.error('Failed to delete workspace', error)
      })
    }
  })

  /** 删除项目 */
  ipcMain.on('util:removeProject', async (event, { workspaceId, projectId }) => {
    const result = await API.window.userGetWindowInfoV2List({ projectIds: projectId }, { headers: { workspaceId } })

    if (result.code === 0) {
      const promiseArr = result.data.rows.map(winInfo => browserManager.removeLocalData(winInfo.dirId!))
      Promise.all(promiseArr).then((data) => {
        console.log('Project deleted successfully', data)
      }).catch((error) => {
        console.error('Failed to delete project', error)
      })
    }
  })

  /** 随机生成字体 */
  ipcMain.on('util:genRandomFonts', (event) => {
    return genRandomFonts(getLocalFonts())
  })

  /** 生成随机指纹 */
  ipcMain.on('util:genRandomFingerprint', (event, payload, count = 1) => {
    return genRandomFingerprint({
      payload,
      count,
      API,
      getMacAddress,
      local_fonts: getLocalFonts(),
    })
  })

  /** 按需调用生成指纹函数 */
  ipcMain.on('util:callRandomFingerprintFunc', (event, payload) => {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (Reflect.has(randomFingerprintFuncMap, key)) {
        const func = Reflect.get(randomFingerprintFuncMap, key)
        Reflect.set(acc, key, func(...value))
      }
      return acc
    }, {})
  })

  /** AES-GCM 加密 */
  ipcMain.on('util:encryptAESGCM', (event, msg) => {
    return encryptAESGCM(msg)
  })

  /** AES-GCM 解密 */
  ipcMain.on('util:decryptAESGCM', (event, msg) => {
    return decryptAESGCM(msg)
  })

  /** 检查端口是否被占用 */
  ipcMain.on('util:checkPort', async (event, port: number) => {
    console.log('util:checkPort', port)
    console.log('store.apiPort', store.apiPort)
    if (port === store.apiPort) {
      return port
    }

    try {
      const availablePort = await getPortPromise({ port })
      return availablePort
    }
    catch (error) {
      console.error('Error checking port:', error)
      return port
    }
  })

  ipcMain.on('util:getApiPort', () => {
    return store.apiPort ?? -1
  })

  /** 在隐藏的 WebContentsView 中加载页面并提取 body 内部的 HTML */
  ipcMain.on('util:fetchHiddenPageHtml', async (event, payload: {
    url: string
    timeoutMs?: number
    settleTimeMs?: number
    userAgent?: string
    partition?: string
  }) => {
    return fetchHiddenPageHtml(payload.url, payload)
  })

  /** 获取公共请求头部 */
  ipcMain.on('util:getCommonRequestHeaders', (event) => {
    return getCommonRequestHeaders()
  })

  /** 获取设备唯一 ID */
  ipcMain.on('util:getDeviceId', async (event) => {
    return encryptAESGCM(await getDeviceId())
  })

  /** 获取推广计划进来的用户的邀请码 */
  ipcMain.on('util:getInviteCode', (event) => {
    return getInviteCode()
  })

  /** 获取设备信息 */
  ipcMain.on('util:getDeviceInfo', async (event) => {
    return getDeviceInfo()
  })

  /** 检测某个快捷键是否被占用 */
  ipcMain.on('util:checkShortcutKeysIsOccupied', async (event, accelerator) => {
    let isRegistered = globalShortcut.isRegistered(accelerator)
    if (!isRegistered) {
      isRegistered = await globalShortcut.register(accelerator, () => {
        console.log(`${accelerator} is pressed`)
      })
      // 如果注册成功，则注销
      if (isRegistered) {
        globalShortcut.unregister(accelerator)
      }
    }
    return isRegistered
  })

  /** 清空安装程序路径 */
  ipcMain.on('util:clearInstallerPath', () => {
    return clearInstallerPath()
  })
}
