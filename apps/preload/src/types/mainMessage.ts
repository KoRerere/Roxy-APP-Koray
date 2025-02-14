export interface MainMessageResult<T = any> {
  code: number
  data: T
  message: string
  error?: any
}

export interface BrowserProcessMessage {
  /** 窗口目录 ID */
  dirId: string
  /** 打开的进度 */
  percent: number
  /** 信息 */
  message: string
  /** 不影响浏览器打开的警告信息 */
  warningMessages: string[]
}

/** 资源更新消息体 */
export interface ResourceUpdateMessage {
  /** 更新类型 */
  type: 'app' | 'patch' | 'web' | 'kernel'
  /** 状态 */
  status?: 'downloading' | 'downloaded' | 'uninstalled' | 'failed'
  /** 下载进度 */
  percent: number
  /** 总大小 */
  total?: number
  /** 更新标题信息 */
  title?: string
  /** 更新描述信息 */
  description: string
  /** 版本号 */
  version?: string
  /** 内核版本 */
  coreVersion?: string
  /** 发布时间 */
  releaseTime?: string
  /** 原始的更新数据 */
  originUpgradeData?: any
}

export interface MainMessage {
  /** 拉起内核过程中的信息 */
  'browser:launch-process-message': (payload: MainMessageResult<BrowserProcessMessage>) => void
  /** 浏览器关闭时 */
  'browser:on-close': (dirId: string) => void
  /** google 授权登录 */
  'oauth2:google-callback': (payload: string) => void
  /** 邀请用户进入项目 */
  'invite:to-project': (payload: string) => void
  /** APP、patch、web 资源更新事件 */
  'app:resource-update': (payload: ResourceUpdateMessage) => void
  /** APP 启动时的消息 */
  'app:launch-message': (payload: string) => void
  /** 内核列表有更新时，发出 */
  'app:core-list-update': (payload: ResourceUpdateMessage[]) => void
  /** 用户升级到 3.1.4 之后，需要弹窗商业化弹窗 */
  'app:show-business-popup': () => void
  /** 同步窗口个数发生变化 */
  'syncControl:syncWindowCountChange': (count: number) => void
  /** 开始同步窗口 */
  'syncControl:start': () => void
  /** 停止同步窗口 */
  'syncControl:stop': () => void
  /** 宫格布局、堆叠布局、自定义布局 */
  'syncControl:doLayout': () => void
  /** 开启/关闭延迟点击 */
  'syncControl:toggleClickDelay': () => void
  /** 开启/关闭延迟输入 */
  'syncControl:toggleInputDelay': () => void
}
