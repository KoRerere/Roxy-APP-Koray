export enum NotifyModule {
  sys = 'sys', // 系统消息
  teams = 'teams', // 团队消息
}

export enum NotifyStatus {
  unread = 0, // 未读
  read = 1, // 已读
}

export enum settingAppearance {
  system = 0, // 系统
  light = 1, // 亮色
  dark = 2, // 暗色
}

export enum ClearType {
  partial = 0, // 清除本地缓存，保留插件
  all = 1, // 清除本地缓存
  cloud = 2, // 清除云端缓存
}
