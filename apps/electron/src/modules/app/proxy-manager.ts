import { app, session } from 'electron'
import { store } from '/@/modules/store'
import { getSystemProxy } from '/@/utils/getSystemProxy'

export type AppNetworkType = 'local' | 'system' | 'custom'

export interface ProxyConfig {
  proxyRules: string
  proxyBypassRules: string
}

export function isCustomProxyConfigured(config?: Pick<typeof store, 'proxyHost' | 'proxyPort'>) {
  const host = (config?.proxyHost ?? store.proxyHost)?.trim()
  const port = Number(config?.proxyPort ?? store.proxyPort)
  return Boolean(host) && port >= 1 && port <= 65535
}

function buildCustomProxyRules(protocol: string, host: string, port: number): string {
  const addr = `${host.trim()}:${port}`
  const normalizedProtocol = protocol.toUpperCase()
  if (normalizedProtocol === 'SOCKS5' || normalizedProtocol === 'SSH') {
    return `socks5=${addr}`
  }
  return `http=${addr};https=${addr}`
}

const BASE_BYPASS_RULES = 'localhost;127.0.0.1'

function getBypassRules(mode: AppNetworkType): string {
  if (mode === 'local') {
    return `*.roxybrowser.*;${BASE_BYPASS_RULES}`
  }
  return BASE_BYPASS_RULES
}

function usesSystemProxy(mode: AppNetworkType) {
  return mode === 'local' || mode === 'system'
}

class ProxyManager {
  private defaultConfig: ProxyConfig = {
    proxyRules: '',
    proxyBypassRules: BASE_BYPASS_RULES,
  }

  private isEnabled = false
  private watcherTimer: ReturnType<typeof setInterval> | null = null
  private authHandlerRegistered = false

  /**
   * 从系统代理获取代理规则
   */
  private async getSystemProxyRules(): Promise<string> {
    try {
      const systemProxy = await getSystemProxy(true)

      if (!systemProxy.addr) {
        return 'direct://'
      }

      const [host, port] = systemProxy.addr.split(':')
      if (!host || !port) {
        return 'direct://'
      }

      return `http=${host}:${port};https=${host}:${port}`
    }
    catch {
      return 'direct://'
    }
  }

  setupProxyAuthHandler() {
    if (this.authHandlerRegistered) {
      return
    }
    this.authHandlerRegistered = true

    app.on('login', (event, _webContents, _details, authInfo, callback) => {
      if (authInfo.isProxy && store.appNetwork === 'custom' && store.proxyUsername) {
        event.preventDefault()
        callback(store.proxyUsername, store.proxyPassword ?? '')
      }
    })
  }

  /**
   * 根据 store.appNetwork 应用 APP 网络代理
   */
  async applyAppNetwork() {
    const mode = store.appNetwork ?? 'local'
    this.stopSystemProxyWatcher()

    if (usesSystemProxy(mode)) {
      return await this.applySystemProxy(mode)
    }

    if (!isCustomProxyConfigured()) {
      console.warn('Custom proxy is not configured, falling back to direct connection')
      return await this.disableProxy()
    }

    try {
      this.defaultConfig.proxyBypassRules = getBypassRules('system')
      this.defaultConfig.proxyRules = buildCustomProxyRules(
        store.proxyProtocol || 'SOCKS5',
        store.proxyHost!,
        store.proxyPort!,
      )
      await session.defaultSession.setProxy(this.defaultConfig)
      this.isEnabled = true
      console.log('Custom APP proxy configured:', this.defaultConfig.proxyRules)
      return true
    }
    catch (error) {
      console.error('Failed to set custom APP proxy:', error)
      return false
    }
  }

  private async applySystemProxy(mode: AppNetworkType = store.appNetwork ?? 'local') {
    try {
      const systemProxyRules = await this.getSystemProxyRules()
      this.defaultConfig.proxyBypassRules = getBypassRules(mode)
      this.defaultConfig.proxyRules = systemProxyRules
      await session.defaultSession.setProxy(this.defaultConfig)
      this.isEnabled = true
      console.log(`APP proxy configured (${mode}):`, systemProxyRules, 'bypass:', this.defaultConfig.proxyBypassRules)
      this.startSystemProxyWatcher()
      return true
    }
    catch (error) {
      console.error('Failed to set system APP proxy:', error)
      return false
    }
  }

  /**
   * 启用默认代理设置（兼容 app:setProxy 等旧调用）
   */
  async enableDefaultProxy() {
    try {
      const systemProxyRules = await this.getSystemProxyRules()
      this.defaultConfig.proxyRules = systemProxyRules

      await session.defaultSession.setProxy(this.defaultConfig)
      this.isEnabled = true
      console.log('Default proxy configured successfully, using system proxy:', systemProxyRules)

      const proxyInfo = await session.defaultSession.resolveProxy('https://www.google.com')
      console.log('Proxy verification result:', proxyInfo)

      return true
    }
    catch (error) {
      console.error('Failed to set default proxy:', error)
      return false
    }
  }

  /**
   * 禁用代理设置
   */
  async disableProxy() {
    try {
      await session.defaultSession.setProxy({})
      this.isEnabled = false
      console.log('Proxy disabled')
      return true
    }
    catch (error) {
      console.error('Failed to disable proxy:', error)
      return false
    }
  }

  /**
   * 重新设置代理（用于在 roxynet 启动后重新应用）
   */
  async resetProxy() {
    return await this.applyAppNetwork()
  }

  startSystemProxyWatcher() {
    if (this.watcherTimer) {
      return
    }

    console.log('Starting system proxy watcher...')
    this.watcherTimer = setInterval(async () => {
      const mode = store.appNetwork ?? 'local'
      if (!usesSystemProxy(mode) || !this.isEnabled) {
        return
      }

      const newSystemProxyRules = await this.getSystemProxyRules()
      const bypassRules = getBypassRules(mode)
      if (
        newSystemProxyRules !== this.defaultConfig.proxyRules
        || bypassRules !== this.defaultConfig.proxyBypassRules
      ) {
        console.log('System proxy change detected, updating...')
        this.defaultConfig.proxyRules = newSystemProxyRules
        this.defaultConfig.proxyBypassRules = bypassRules
        await session.defaultSession.setProxy(this.defaultConfig)
      }
    }, 15 * 1000)
  }

  stopSystemProxyWatcher() {
    if (this.watcherTimer) {
      clearInterval(this.watcherTimer)
      this.watcherTimer = null
      console.log('System proxy watcher stopped')
    }
  }

  isProxyEnabled() {
    return this.isEnabled
  }

  getCurrentConfig(): ProxyConfig {
    return { ...this.defaultConfig }
  }

  updateConfig(config: Partial<ProxyConfig>) {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  async getSystemProxyInfo() {
    try {
      const { addr } = await getSystemProxy(true)
      return {
        address: addr,
        isEnabled: !!addr,
        proxyRules: this.defaultConfig.proxyRules,
      }
    }
    catch (error) {
      console.error('Failed to get system proxy info:', error)
      return {
        address: '',
        isEnabled: false,
        proxyRules: this.defaultConfig.proxyRules,
      }
    }
  }
}

export const proxyManager = new ProxyManager()
