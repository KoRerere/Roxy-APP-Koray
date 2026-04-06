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

export enum ClearType {
  partial = 'partial', // 清除本地缓存，保留插件
  all = 'all', // 清除本地缓存
  cloud = 'cloud', // 清除云端缓存
}

export enum UaStrictMode {
  close = 0, // 关闭
  open = 1, // 开启
}

export enum WorkspaceType {
  /** 私有 */
  Private = 0,
  /** 公共 */
  Public = 1,
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
}
