import axios from 'axios'
import { compare } from 'compare-versions'
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { chmod, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { isMac, isProd, isWindows } from '/@/constants/common'
import { fileOperations } from '/@/modules/fileOperations'
import { fileExists } from '/@/utils'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 发布时间 */
  releaseTime: string
}

const os = isWindows ? 'Windows' : 'macOS'

export const resourceUpdater = new class ResourceUpdater {
  timer: NodeJS.Timeout | null = null
  /** web 资源包下载地址 */
  webDomain = ''
  /** 是否在下载中 */
  isInProgress = false
  /** 远程 web 资源版本信息 */
  remoteVersionInfo: VersionInfo | null = null

  resourceFileName = isMac ? 'roxybrowser.app.zip' : 'roxybrowser.exe'

  localResourcePath = join(appConfig.defaultBrowserBinDir, this.resourceFileName)

  /** 最新 web 资源版本号文件地址 */
  get versionUrl() {
    return `${this.webDomain}/public/static/browser-launcher/${os}/version.json`
  }

  /** web 资源包下载地址 */
  get downloadUrl() {
    return `${this.webDomain}/public/static/browser-launcher/${os}/${this.resourceFileName}`
  }

  constructor() {
    this.startInterval()
  }

  async startInterval() {
    this.stopInterval()
    this.timer = setInterval(() => {
      this.checkForUpdates()
    }, 1000 * 60 * 10)
  }

  async stopInterval() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  async checkForUpdates() {
    if (this.isInProgress || isProd) {
      return
    }

    this.isInProgress = true
    console.log('[ResourceUpdater] checkForUpdates start')
    try {
      this.webDomain = await getWebDomain(false)
      // 获取远程版本信息
      const remoteVersionInfo = await axios.get<VersionInfo>(this.versionUrl).then(response => response.data)
      console.log('[ResourceUpdater] remoteVersionInfo', remoteVersionInfo)

      if (this.remoteVersionInfo && compare(this.remoteVersionInfo.version, remoteVersionInfo.version, '>=')) {
        this.isInProgress = false
        console.log('[ResourceUpdater] checkForUpdates already downloaded')
        return
      }

      const versionFilePath = join(appConfig.defaultBrowserBinDir, `version.json`)
      // 获取本地版本信息
      const localVersion = await readFile(versionFilePath, 'utf8').then(data => JSON.parse(data).version).catch(() => '0.0.0')
      console.log('[ResourceUpdater] localVersion', localVersion)
      console.log('[ResourceUpdater] remoteVersion', remoteVersionInfo.version)
      // 检查是否需要更新
      if (compare(remoteVersionInfo.version, localVersion, '>')) {
        console.log('[ResourceUpdater] downloading...')
        const response = await axios({
          url: this.downloadUrl,
          method: 'get',
          responseType: 'stream',
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.total || 0
            const current = progressEvent.loaded
            const percentage = Math.round((current / total) * 100)
            console.log(`[ResourceUpdater] Download progress: ${percentage}%`)
          },
        })
        await fileExists(dirname(appConfig.defaultBrowserBinPath), true)

        const writer = createWriteStream(this.localResourcePath)
        const { promise, resolve, reject } = Promise.withResolvers<void>()

        response.data.pipe(writer)
        writer.on('finish', async () => {
          writer.close()
          this.remoteVersionInfo = remoteVersionInfo
          console.log('[ResourceUpdater] write version file', versionFilePath)
          if (isMac) {
            await this.extractMac()
          }
          await writeFile(versionFilePath, JSON.stringify(remoteVersionInfo, null, 2), 'utf8')

          resolve()
        })
        writer.on('error', reject)

        await promise
        console.log('[ResourceUpdater] downloaded')
      }
    }
    catch (error) {
      console.error('[ResourceUpdater] checkForUpdates error', error)
    }
    finally {
      this.isInProgress = false
    }
    console.log('[ResourceUpdater] checkForUpdates end')
  }

  /** 解压 mac 资源包 */
  async extractMac() {
    console.log('[ResourceUpdater] extract start')
    const appPath = join(appConfig.defaultBrowserBinDir, 'roxybrowser.app')
    const macosBinPath = join(appPath, 'Contents/MacOS/roxybrowser')

    // 先清理旧的 app，避免覆盖时残留导致异常
    await rm(appPath, { recursive: true, force: true }).catch(() => {})

    try {
      // macOS：用 ditto 解压 zip，尽量保留权限/资源 fork
      const r = spawnSync('ditto', ['-x', '-k', this.localResourcePath, appConfig.defaultBrowserBinDir], {
        stdio: 'pipe',
        encoding: 'utf8',
      })
      if (r.status !== 0) {
        throw new Error(r.stderr || r.stdout || 'ditto 解压失败')
      }
    }
    catch (error) {
      // 兜底：仍走原来的 adm-zip 解压（可能会丢可执行位）
      console.warn('[ResourceUpdater] ditto extract failed, fallback to adm-zip:', error)
      await fileOperations.executeTask('decompress', {
        src: this.localResourcePath,
        dest: appConfig.defaultBrowserBinDir,
      })
    }
    finally {
      this.remoteVersionInfo = null
    }

    // 修复常见问题：可执行位 + quarantine
    await chmod(macosBinPath, 0o755).catch(() => {})
    // 某些 zip 可能导致 Frameworks 内可执行位丢失，这里做一个保守的“尽力补救”
    await chmod(join(appPath, 'Contents/MacOS'), 0o755).catch(() => {})
    await chmod(join(appPath, 'Contents/Frameworks'), 0o755).catch(() => {})

    // 去掉 quarantine，避免系统把它当作“下载的未知应用/已损坏”
    spawnSync('xattr', ['-dr', 'com.apple.quarantine', appPath], { stdio: 'pipe' })

    console.log('[ResourceUpdater] extract done:', appPath)
  }
}()
