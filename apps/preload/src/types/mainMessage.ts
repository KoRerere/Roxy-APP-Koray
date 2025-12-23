import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'

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
  status?: 'downloading' | 'downloaded' | 'uninstalled' | 'failed' | 'update'
  /** 下载进度 */
  percent?: number
  /** 总大小 */
  total?: number
  /** 更新标题信息 */
  title?: string
  /** 更新描述信息 */
  description?: string
  /** 更新内容 */
  upgradeContent?: string
  /** 版本号 */
  version?: string
  /** 当前版本 */
  currentVersion?: string
  /** 内核版本 */
  coreVersion?: string
  /** 发布时间 */
  releaseTime?: string
  /** 新功能提示 */
  newFeatureTips?: Record<string, any>
  /** 原始的更新数据 */
  originUpgradeData?: any
  /** 是否静默下载 */
  silent?: boolean
}

export interface MainMessage {
  /** 拉起内核过程中的信息 */
  'browser:launch-process-message': (payload: MainMessageResult<BrowserProcessMessage>) => void
  /** 已打开的内核个数变化时发出 */
  'browser:opened-browser-list-change': (winInfoList: WindowItemType[]) => void
  /** 浏览器关闭时 */
  'browser:on-close': (dirIds: string[]) => void
  /** 浏览器关闭时，同步数据中 */
  'browser:on-close-syncing-data': (dirIds: string[]) => void
  /** 达到窗口打开次数限制 */
  'browser:window-open-limit': (result: { code: number, msg: string }) => void
  /** 用户被挤号 */
  'user:kicked-out': (params: { deviceName: string, createTime: string }) => void
  /** google 授权登录 */
  'oauth2:google-callback': (payload: string) => void
  /** 邀请用户进入项目 */
  'invite:to-project': (payload: string) => void
  /** 打开某个页面 */
  'open:page': (payload: string) => void
  /** APP、patch、web 资源更新事件 */
  'app:resource-update': (payload: ResourceUpdateMessage) => void
  /** APP 启动时的消息 */
  'app:launch-message': (payload: string) => void
  /** 内核列表有更新时，发出 */
  'app:core-list-update': (payload: ResourceUpdateMessage[]) => void
  /** 后端地址发生变化 */
  'app:backend-url-change': (payload: string) => void
  /** 当主窗口聚焦时 */
  'window:on-focus': () => void
  /** 插件下载进度, 如果 errorTips 不为空，则表示下载失败 */
  'extension:download-progress': (payload: { extID: string, percent: number, errorTips?: string }) => void
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
  /** 暂停同步 */
  'syncControl:pause': () => void
  /** 恢复同步 */
  'syncControl:resume': () => void
}
