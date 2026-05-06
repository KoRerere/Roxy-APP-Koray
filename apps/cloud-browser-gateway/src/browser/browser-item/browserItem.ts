import type { WindowItemType as BaseWindowItemType } from './types'
import type { ZipFileEntry } from '~/utils'
import type { Browser } from 'puppeteer-core'
import { genRandomFingerprint } from '@roxy/shared'
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API } from '~/api'
import { createAliOSSStore, decryptAESGCM, getLocalFonts, getMacAddress, proxyDetection, zipFileListToFile } from '~/utils'
import { getInvalidUrls, getNeedSyncLocalFileMap } from './constants'

type WindowItemType = BaseWindowItemType & Record<string, any>

export interface SessionContext {
  token: string
  workspaceId: number
}

export class BrowserItem {
  /** 当前浏览器配置信息 */
  winInfo: WindowItemType
  /** 当前浏览器用户数据目录 */
  readonly userDataDir: string
  /** 浏览器实例（由外部通过 setBrowser 注入） */
  private browser: Browser | null = null
  /** 会话上下文（token + workspaceId），确保多用户隔离 */
  private sessionContext: SessionContext

  get requestHeaders() {
    return {
      token: this.sessionContext.token,
      workspaceId: this.sessionContext.workspaceId,
    }
  }

  /** 指纹配置文件路径 */
  get fingerprintConfigPath() {
    return join(this.userDataDir, 'lumi.conf')
  }

  get closeTimestampPath() {
    return join(this.userDataDir, 'close_timestamp')
  }

  get roxyTabsPath() {
    return join(this.userDataDir, 'roxy_tabs')
  }

  get roxyLocalStatePath() {
    return join(this.userDataDir, 'Local State')
  }

  get lumiLoginPath() {
    return join(this.userDataDir, 'Default', 'LumiLogin')
  }

  get preferencesPath() {
    return join(this.userDataDir, 'Default', 'Preferences')
  }

  get ossCacheDir() {
    return join(this.userDataDir, 'oss-session')
  }

  get ossCacheVersionPath() {
    return join(this.ossCacheDir, 'version')
  }

  /** 需要同步到 OSS 的文件列表 */
  get needSyncFiles() {
    return Object.entries(getNeedSyncLocalFileMap())
      .filter(([key]) => this.winInfo[key])
      .flatMap(([_, value]) => value)
  }

  readonly browserCacheFileName = 'browser-cache.zip'

  constructor(winItem: WindowItemType, userDataDir: string, sessionContext: SessionContext) {
    this.winInfo = winItem
    this.userDataDir = userDataDir
    this.sessionContext = sessionContext
  }

  /** 注入浏览器实例（由 BrowserService.connect 后调用） */
  setBrowser(browser: Browser) {
    this.browser = browser
  }

  /** 获取浏览器实例 */
  getBrowser(): Browser | null {
    return this.browser
  }

  /** 解密代理信息 */
  async decryptProxyInfo() {
    const { isEncryptProxy, proxyEncryptInfo } = this.winInfo
    if (isEncryptProxy && proxyEncryptInfo) {
      const decryptedProxyEncryptInfo = await decryptAESGCM(proxyEncryptInfo)
      Object.assign(this.winInfo, decryptedProxyEncryptInfo)
    }
  }

  /** 启动时生成随机指纹 */
  async handleRandomFingerprint() {
    if (!this.winInfo.randomFingerprint)
      return

    try {
      const [fingerprint] = await genRandomFingerprint({
        payload: this.winInfo,
        count: 1,
        genType: 'api',
        API,
        getMacAddress,
        local_fonts: getLocalFonts(),
      }).catch((error: any) => {
        console.error('生成随机指纹失败：', error)
        return Promise.reject(new Error($t('启动时生成随机指纹失败')))
      })

      const { code } = await API.window.userMdfWindowInfoSingleV2Create(
        { id: this.winInfo.id, ...fingerprint },
        { headers: this.requestHeaders },
      )
      if (code === 0) {
        const { code, data } = await API.window.userGetWindowInfoV2List(
          { id: this.winInfo.id, sourceType: 'open' } as any,
          { headers: this.requestHeaders },
        )
        if (code === 0 && data.rows[0]) {
          Object.assign(this.winInfo, data.rows[0])
        }
      }
    }
    catch (error) {
      console.error('处理随机指纹失败：', error)
    }
  }

  /** 代理检测 */
  async proxyDetection() {
    const { host } = this.winInfo

    if (!host) {
      const { code, data } = await API.window.userGetCloudBrowserExperienceProxyList({
        id: this.winInfo.id,
      }, { headers: this.requestHeaders })
      console.log('userGetCloudBrowserExperienceProxyList', { code, data })
      if (code === 0 && data) {
        Object.assign(this.winInfo, data)
      }
    }

    const { protocol, port, ...res } = await proxyDetection(this.winInfo as any)
    const _protocol = protocol || this.winInfo.protocol?.split('/')[0]
    const _port = port || this.winInfo.port?.toString().split('/')[0]
    this.winInfo.protocol = _protocol
    this.winInfo.proxyCategory = _protocol
    this.winInfo.port = _port
    return res
  }

  /** 浏览器关闭后上传数据 */
  async uploadData(afterLaunchData: { defaultOpenUrl: string[], cookie: any, lumiLogin: string }) {
    const { id, dirId, syncValue: _syncValue, ossDirPath, syncCookie } = this.winInfo
    const syncValue = _syncValue as Record<string, any> | undefined

    const needSyncFiles: ZipFileEntry[] = this.needSyncFiles.map(url => ({
      filePath: join(this.userDataDir, url),
      zipPath: url,
    }))

    const outputZipPath = join(this.ossCacheDir, this.browserCacheFileName)
    let newVersion = syncValue?.version || 1
    const lastFileCount = syncValue?.fileCount
    let isUploadSuccess = false

    try {
      if (needSyncFiles.length === 0 && lastFileCount === 0) {
        console.log('没有需要同步的文件')
      }
      else {
        await zipFileListToFile(needSyncFiles, outputZipPath)
        const remoteOssPath = `${ossDirPath}${this.browserCacheFileName}`
        const readStream = createReadStream(outputZipPath)
        console.log('正在上传缓存文件到', remoteOssPath)
        const aliOSS = await createAliOSSStore(this.requestHeaders)
        await aliOSS.putStream(remoteOssPath, readStream)
        newVersion = newVersion + 1
        isUploadSuccess = true
        await Promise.all([
          writeFile(this.ossCacheVersionPath, String(newVersion)),
          writeFile(this.closeTimestampPath, `${Date.now().toString()}_${dirId}`),
        ]).catch((error) => {
          console.error('写入本地同步元数据失败：', error)
        })
        console.log('OSS 缓存文件上传成功')
      }
    }
    catch (error) {
      console.error('上传数据到 OSS 失败：', error)
    }
    finally {
      const uploadParams = {
        id,
        cookie: syncCookie
          ? (Array.isArray(afterLaunchData.cookie) ? JSON.stringify(afterLaunchData.cookie) : afterLaunchData.cookie)
          : undefined,
        defaultOpenUrl: afterLaunchData.defaultOpenUrl,
        lumiLogin: afterLaunchData.lumiLogin,
        syncValue: {
          version: newVersion,
          fileCount: isUploadSuccess ? needSyncFiles.length : syncValue?.fileCount,
        },
        openStatus: false,
      }

      await API.window.userMdfWindowSyncV2Create([uploadParams], { headers: this.requestHeaders })
        .then(res => console.log('窗口同步数据上传成功：', res))
        .catch(err => console.error('窗口同步数据上传失败：', err))
    }
  }

  /** 是否是有效的 URL */
  isValidURL(url: string) {
    return !getInvalidUrls().some(n => url.startsWith(n!))
  }
}
