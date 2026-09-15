export enum NotifyModule {
  sys = 'sys', // 系统消息
  teams = 'teams', // 团队消息
}

export enum NotifyStatus {
  unread = 0, // 未读
  read = 1, // 已读
}

export enum SettingAppearance {
  system = 0, // 系统
  light = 1, // 亮色
  dark = 2, // 暗色
}

export enum NetworkType {
  Local = 'local', // 本地网络
  System = 'system', // 系统代理
  Custom = 'custom', // 自定义代理
}

export enum ClearType {
  partial = 'partial', // 清除本地缓存，保留插件
  all = 'all', // 清除本地缓存
  cloud = 'cloud', // 清除云端缓存
}

export enum UaStrictMode {
  close = 0, // 关闭
  open = 1, // 开启
}

export enum TaskbarTabDisplay {
  tabTitle = 'tabTitle',
  windowName = 'windowName',
}

export enum TaskbarIconDisplay {
  windowNum = 'windowNum',
  windowName = 'windowName',
}

/** 恢复窗口前客户端网络变化时的处理方式 */
export enum RestoreWindowNetworkChange {
  /** 弹出提示 */
  Prompt = 'prompt',
  /** 继续恢复窗口 */
  Continue = 'continue',
  /** 终止恢复窗口 */
  Abort = 'abort',
}

export enum WorkspaceType {
  /** 私有 / 普通模式 */
  Private = 0,
  /** 公共 — @legacy，当前未使用 */
  Public = 1,
  /** 电商模式 */
  ECommerce = 2,
}

export enum ActivityType {
  /** 无活动 */
  None = 0,
  /** 新年活动 */
  NewYear = 1,
  /** 春节活动 */
  SpringFestival = 2,
  /** 复活节活动 */
  Easter = 3,
  /** 自由季活动 */
  Freedom = 4,
  /** 618 活动 */
  JuneEighteen = 6,
  /** 中秋活动 */
  MidAutumnFestival = 7,
}

/**
 * 浏览器类型
 */
export enum CoreType {
  Chrome = 'Chrome',
  Firefox = 'Firefox',
}
