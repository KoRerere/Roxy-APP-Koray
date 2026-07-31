export interface StoreType {
  /** 工作台新手引导 */
  dashboardTourGuide?: boolean
  /** 语言 */
  language: string
  /** 浏览器文件缓存根目录 */
  browserCacheRootDir: string
  /** 默认浏览器 dirId */
  defaultBrowserDirId: string
  /** 默认浏览器 workspaceId */
  defaultBrowserWorkspaceId?: number
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
  /** 上次登录用户 ID */
  lastUserId?: number
  /** 空间 ID */
  workspaceId?: number
  /** 当前空间业务模式：0 普通 / 2 电商（供工作台等本地页文案） */
  workspaceType?: number
  /** 当前用户所有的空间 ID */
  allWorkspaceId?: number[]
  /** 公共空间列表 */
  sharedWorkspaceList?: { workspaceId: number, role: number }[]
  /**
   * @deprecated 使用 networkMode 替代；false 对应 local，true 对应 system
   */
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
    delayRange: [number, number]
    enable: false
    humanNoise: true
    shortcutKey: 'Shift E'
  }
  /** 是否开启谷歌账号登录 */
  googleLoginEnable?: boolean
  /** 是否开启 IP 变化提示 */
  ipChangeModal?: boolean
  /** 是否显示新功能提示 */
  showNewFeatureTips?: boolean
  /** 下次更新时间 */
  nextUpdateTimestamp?: number
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
  /** @deprecated 使用 autoUpdateAppOnLaunch；仅作旧版配置迁移来源 */
  autoUpdateApp?: boolean
  /** 自动更新客户端：Windows 控制冷启动安装；macOS/Linux 控制退出时静默安装 */
  autoUpdateAppOnLaunch?: boolean
  /** 已下载待安装的 APP 版本（Windows 本地标记，供冷启动离线探测） */
  pendingAppUpdateVersion?: string
  /** 待安装包对应的 generic feed URL（Windows 冷启动安装需要） */
  pendingAppUpdateFeedUrl?: string
  /** 窗口自动恢复, 0: 关闭, 1: 开启, 2: 弹出提示 */
  autoRestoreWindow?: 0 | 1 | 2
  /** 恢复窗口前客户端网络变化时的处理方式：prompt | continue | abort */
  restoreWindowNetworkChange?: 'prompt' | 'continue' | 'abort'
  /** 上次记录恢复窗口时的客户端网络快照，仅本地存储 */
  lastRestoreClientNetwork?: {
    ip: string
    country: string
    country_code: string
    city: string
  }
  /** 等待恢复的窗口 { workspaceId: dirId[] } */
  waitingRestoreWindow?: Record<string, string[]>
  /** 等待恢复的窗口 bounds {  dirId: { left: number, top: number, width: number, height: number } } */
  waitingRestoreWindowBounds?: Record<string, {
    left: number
    top: number
    width: number
    height: number
  }>
  /** 下次启动时是否需要恢复窗口 */
  needRestoreWindow?: boolean
  /** 默认浏览器启动器进程 ID */
  defaultBrowserLauncherPid?: number
  /** 是否自动更新内核，已下载的内核并未使用时将会自动更新 */
  autoUpdateKernel?: false
  /** 最后一次使用的 ip2location url */
  lastUseIp2locationUrl?: string
  /** 应用是否正常退出 */
  appNormalExit?: boolean
  /** 最后一次使用的 web 域名 */
  lastWebDomain?: string
  /** 是否第一次清除 web 缓存 */
  isFirstClearWebCache: boolean
  /** 上次选择的网络线路 */
  lastSelectedNetworkNode: 'auto' | {
    /** 站点域名 */
    site: string
    /** 网关域名 */
    gate: string
    /** API 域名 */
    api: string
  }
  /** 任务栏图标显示：windowNum | windowName */
  taskbarIconDisplay?: 'windowNum' | 'windowName'
  /** 任务栏标签显示：tabTitle | windowName */
  taskbarTabDisplay?: 'tabTitle' | 'windowName'
  /** APP 网络模式：local | system | custom */
  appNetwork?: 'local' | 'system' | 'custom'
  /** 内核网络模式：local | system | custom */
  networkMode?: 'local' | 'system' | 'custom'
  /** APP 自定义代理协议 */
  proxyProtocol?: string
  /** APP 自定义代理主机 */
  proxyHost?: string
  /** APP 自定义代理端口 */
  proxyPort?: number
  /** APP 自定义代理账号 */
  proxyUsername?: string
  /** APP 自定义代理密码 */
  proxyPassword?: string
}
