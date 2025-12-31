export interface StoreType {
  language: string
  /** 浏览器文件缓存根目录 */
  browserCacheRootDir: string
  /** 默认浏览器 dirId */
  defaultBrowserDirId: string
  /** 默认浏览器 workspaceId */
  defaultBrowserWorkspaceId: number
  /**
   * 软件关闭时
   * - pop: 弹出提示
   * - min: 最小化到托盘
   * - exit: 直接退出
   */
  closeSoft: 'pop' | 'min' | 'exit'
  /** 性能监控 */
  memoryLimit: number
  /** 磁盘限制 */
  diskLimit: number
  /** 是否开启自动清除缓存 */
  autoClearCache: boolean
  /** 自动清除缓存时间 */
  clearCachePeriod: number
  /** 自动清除缓存类型 */
  clearCacheType: 'partial' | 'all'
  /** 用户 token */
  token?: string
  /** 用户 ID */
  userId?: number
  /** 空间 ID */
  workspaceId?: number
  /** 当前用户所有的空间 ID */
  allWorkspaceId?: number[]
  /** 公共空间列表 */
  sharedWorkspaceList?: { workspaceId: number, role: number }[]
  /** 是否使用系统代理 */
  systemProxySwitch?: boolean
  /** roxynet 本地 http 服务端口 */
  roxynetLocalHttpPort?: number
  /** roxynet 代理端口 */
  roxynetProxyPort?: number
  /** roxynet v2ray 兼容模式 */
  v2raySwitch?: boolean
  /** APP 本地服务端口 */
  appPort: number
  /** APP WebSocket 端口 */
  appWsPort: number
  /** openapi key */
  apiKey?: string
  /** 用户传过来的 userApiToken */
  userApiToken?: string
  /** openapi 端口 */
  apiPort?: number
  /** 不走代理的地址 - google会导致代理被墙，开发环境默认加上 */
  ipBlackList: string[]
  /** ipv6Check 检测地址 */
  ipv6CheckUrl?: string
  /** 域名禁止访问 */
  blockDomainList: string[]
  /** Default IP checker */
  ipChecker: string
  /** 是否使用外置 web 资源 */
  isExternalWeb: boolean
  /** 设备 ID */
  deviceId?: string
  /** mac 地址 */
  mac?: string
  /** 是否开启工作台, 0: 不开启, 1: 开启 */
  openWorkbench?: 0 | 1
  /** 订阅等级 */
  subLevel?: string
  /** 用户信息 */
  userInfo: {
    username: string
    email: string
  }
  simulation: {
    delay: 100
    enable: false
    shortcutKey: 'Shift E'
  }
  /** 是否开启谷歌账号登录 */
  googleLoginEnable?: boolean
  /** 是否开启 IP 变化提示 */
  ipChangeModal?: boolean
  /** 是否显示新功能提示 */
  showNewFeatureTips?: boolean
  /** 浏览器主题 */
  browserColorScheme?: 'light' | 'dark' | 'system'
  /** 书签 */
  bookText?: Record<string, any>
  /** 记录上次登录时间，15 天内不活动，则清除 token，重新登录 */
  lastLoginTime: number
  /** 是否显示长时间未登录提示 */
  showLongTimeNotLoginTips?: boolean
  /** 访客 ID */
  visitorId?: string
  /** 此设备是否有登录过 */
  hasLoggedIn?: boolean
  /** 开机自启动 */
  autoStart?: boolean
  /** 默认浏览器启动器进程 ID */
  defaultBrowserLauncherPid?: number
}
