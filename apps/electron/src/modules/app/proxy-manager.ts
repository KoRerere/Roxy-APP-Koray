import { session } from 'electron'
import { getSystemProxy } from '/@/utils/getSystemProxy'

export interface ProxyConfig {
  proxyRules: string
  proxyBypassRules: string
}

class ProxyManager {
  private defaultConfig: ProxyConfig = {
    proxyRules: '', // 将从系统代理获取
    proxyBypassRules: '*.lumibrowser.*;*.roxybrowser.*;localhost;127.0.0.1',
  }

  private isEnabled = false

  /**
   * 从系统代理获取代理规则
   */
  private async getSystemProxyRules(): Promise<string> {
    try {
      /**
       * 强制获取最新系统代理
       */
      const systemProxy = await getSystemProxy(true)

      if (!systemProxy.addr) {
        return 'direct://'
      }

      // 解析系统代理地址
      const [host, port] = systemProxy.addr.split(':')
      if (!host || !port) {
        return 'direct://'
      }

      // 构建 proxyRules 格式
      const proxyRules = `http=${host}:${port};https=${host}:${port}`
      return proxyRules
    }
    catch (error) {
      return 'direct://'
    }
  }

  /**
   * 启用默认代理设置
   */
  async enableDefaultProxy() {
    try {
      // 获取系统代理设置
      const systemProxyRules = await this.getSystemProxyRules()
      this.defaultConfig.proxyRules = systemProxyRules

      await session.defaultSession.setProxy(this.defaultConfig)
      this.isEnabled = true
      console.log('Default proxy configured successfully, using system proxy:', systemProxyRules)

      // 验证代理设置
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
    if (this.isEnabled) {
      return await this.enableDefaultProxy()
    }
    return true
  }

  /**
   * 监听系统代理变化并自动更新
   */
  startSystemProxyWatcher() {
    // 每15秒检查一次系统代理变化
    setInterval(async () => {
      if (this.isEnabled) {
        const newSystemProxyRules = await this.getSystemProxyRules()
        if (newSystemProxyRules !== this.defaultConfig.proxyRules) {
          console.log('System proxy change detected, updating...')
          this.defaultConfig.proxyRules = newSystemProxyRules
          await this.enableDefaultProxy()
        }
      }
    }, 15 * 1000) // 15秒检查一次
  }

  /**
   * 检查代理是否已启用
   */
  isProxyEnabled() {
    return this.isEnabled
  }

  /**
   * 获取当前代理配置
   */
  getCurrentConfig(): ProxyConfig {
    return { ...this.defaultConfig }
  }

  /**
   * 更新代理配置
   */
  updateConfig(config: Partial<ProxyConfig>) {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * 获取当前系统代理信息
   */
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
