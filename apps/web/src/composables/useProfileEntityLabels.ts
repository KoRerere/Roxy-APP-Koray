import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 普通模式「窗口」与电商模式「账号」的展示文案 */
export interface ProfileEntityLabels {
  /** 管理单元名称：窗口 / 账号 */
  entity: string
  open: string
  close: string
  view: string
  entityName: string
  entityId: string
  entityIdExportOnly: string
  exportEntities: string
  exportCookieTip: string
  /** 清除缓存说明中的指纹描述片段 */
  clearCachePartialNote: string
  clearCacheAllNote: string
  addRemarkTitle: string
  selectedCookiesWarning: string
  closeEntity: string
  closeEntityAfterComplete: string
  cookieRobotHelp: string
  cannotOpenDisk: string
  closeBeforeAction: string
  proxyExpiredBeforeOpen: string
  getStatusFailed: string
  /** 转移选团队时的简短额度提示：窗口额度不足 / 账号额度不足 */
  quotaInsufficientShort: string
  quotaInsufficientContactOwner: string
  transferSingle: string
  transferMultiple: (count: number) => string
  batchOpenAndArrange: (count: number) => string
  /** 标签页：已关联窗口 / 已关联账号 */
  relatedProfilesColumn: string
  /** 删除标签确认文案 */
  deleteTagConfirmMessage: string
  entityRemark: string
  entitySize: string
  entityPosition: string
  entityPositionTooltip: string
  unnamedEntityPlaceholder: string
  syncExtensionApps: string
  /** 软件设置：面板分组标题 */
  settingsPanelSubtitle: string
  entityNum: string
  entityDisplayName: string
  openWorkbenchWhenOpen: string
  googleLoginEnableDesc: string
  searchEngineWhenOpen: string
  batchOpenLayoutDesc: string
  stopOpenWhenDiskLow: string
  stopOpenWhenMemoryLow: string
  clearCachePartialTooltipPlain: string
  clearCacheAllTooltipPlain: string
  clearUnusedEntityCacheDesc: string
  clearUnusedEntityCacheKeypath: string
  customBookmarksPreferenceDesc: string
  autoRestoreEntity: string
  autoRestoreEntityDesc: string
  restoreEntityNetworkChangeDesc: string
  continueRestoreEntity: string
  abortRestoreEntity: string
  closeAllEntitiesOnExit: string
  themeEntitySettingsNote: string
  migrateCacheBeforeLaunch: string
  existingEntityCachePathNote: string
  migrateCacheAcknowledge: string
  avoidCacheLossKeypath: string
  mergeBookmarksWithEntity: string
  overwriteEntityBookmarks: string
  closeBrowserBeforeDirectoryChange: string
  entityUsageCount: (count: number) => string
  exceedsMaxCreatableEntities: string
  defaultEntityInfoExample: string
  entityInfoExample: (name: string) => string
  /** 关联列表添加按钮 tooltip：选择窗口 / 选择账号 */
  selectEntityTooltip: string
}

/**
 * 按 workspace 模式生成浏览器配置文件（窗口/账号）相关 UI 文案
 * @param isEcommerce 是否为电商 workspace
 */
export function createProfileEntityLabels(isEcommerce: boolean): ProfileEntityLabels {
  if (isEcommerce) {
    return {
      entity: $t('账号'),
      open: $t('启动'),
      close: $t('关闭账号'),
      view: $t('查看账号'),
      entityName: $t('账号名称'),
      entityId: $t('账号 ID'),
      entityIdExportOnly: $t('账号 ID (仅导出用)'),
      exportEntities: $t('要导出的账号:'),
      exportCookieTip: $t('*对于具有大量 cookie 的账号，请选择 .txt 格式'),
      clearCachePartialNote: $t('清除插件数据以外的所有本地缓存文件，{light}！账号指纹信息、IP 不会被清理。', { light: '{light}' }),
      clearCacheAllNote: $t('清除所有本地缓存文件，{light}！账号指纹信息、IP 不会被清理。', { light: '{light}' }),
      addRemarkTitle: $t('请为账号添加备注'),
      selectedCookiesWarning: $t('所选账号的所有 Cookie 都将被覆盖，请谨慎操作。'),
      closeEntity: $t('关闭账号'),
      closeEntityAfterComplete: $t('开启后，执行完成或出现异常时自动关闭账号'),
      cookieRobotHelp: $t('帮助新账号生成浏览记录，降低被网站识别为异常环境的风险。'),
      cannotOpenDisk: $t('当前所在磁盘空间不足 {bold}，无法打开账号。您可以前往软件设置中调整磁盘限制。', { bold: '{bold}' }),
      closeBeforeAction: $t('请先关闭账号'),
      proxyExpiredBeforeOpen: $t('绑定的设备已过期，请在打开账号前更新设备信息'),
      getStatusFailed: $t('获取账号状态信息失败'),
      quotaInsufficientShort: $t('账号额度不足'),
      quotaInsufficientContactOwner: $t('账号额度不足，请联系空间的拥有者进行升级'),
      transferSingle: $t('转移账号'),
      transferMultiple: count => $t('转移 {count} 个账号', { count }),
      batchOpenAndArrange: count => $t('打开并排列 {count} 个账号', { count }),
      relatedProfilesColumn: $t('已关联账号'),
      deleteTagConfirmMessage: $t('您确认要删除所选标签吗？删除后，关联账号的标签将被清除。'),
      entityRemark: $t('账号备注'),
      entitySize: $t('账号大小'),
      entityPosition: $t('账号位置'),
      entityPositionTooltip: $t('账号打开时在屏幕中的初始位置'),
      unnamedEntityPlaceholder: $t('未命名账号(选填)'),
      syncExtensionApps: $t('同步插件应用程序'),
      settingsPanelSubtitle: $t('账号'),
      entityNum: $t('账号编号'),
      entityDisplayName: $t('账号名字'),
      openWorkbenchWhenOpen: $t('打开账号时，是否打开工作台页面'),
      googleLoginEnableDesc: $t('账号是否开启谷歌账号登录（火狐内核的账号暂不支持此功能。）'),
      searchEngineWhenOpen: $t('打开账号时，浏览器使用的默认搜索引擎'),
      batchOpenLayoutDesc: $t('批量打开账号时，账号的布局方式'),
      stopOpenWhenDiskLow: $t('磁盘空间低于设置的阈值时，将停止打开浏览器账号'),
      stopOpenWhenMemoryLow: $t('内存使用达到设置的阈值时，将停止打开浏览器账号'),
      clearCachePartialTooltipPlain: $t('清除插件数据以外的所有本地缓存文件，登录状态不会失效！账号指纹信息、IP 不会被清理。'),
      clearCacheAllTooltipPlain: $t('清除所有本地缓存文件，登录状态不会失效！账号指纹信息、IP 不会被清理。'),
      clearUnusedEntityCacheDesc: $t('清除过去指定时间内未使用账号的缓存数据'),
      clearUnusedEntityCacheKeypath: $t('清除过去{input}未使用账号的缓存数据', { input: '{input}' }),
      customBookmarksPreferenceDesc: $t('账号偏好设置中开启“自定义书签”功能生效'),
      autoRestoreEntity: $t('账号自动恢复'),
      autoRestoreEntityDesc: $t('主动重启客户端后，恢复上次账号打开状态'),
      restoreEntityNetworkChangeDesc: $t('自动恢复账号前，若客户端网络环境变化'),
      continueRestoreEntity: $t('继续恢复账号'),
      abortRestoreEntity: $t('终止恢复账号'),
      closeAllEntitiesOnExit: $t('点击【继续】将关闭所有账号并退出'),
      themeEntitySettingsNote: $t('您已调整客户端主题，可在【软件设置】中进一步设置浏览器账号主题'),
      migrateCacheBeforeLaunch: $t('在修改缓存路径后，请您务必于再次启动账号前'),
      existingEntityCachePathNote: $t('修改缓存路径后，现有账号启动时将从新路径尝试读取缓存。'),
      migrateCacheAcknowledge: $t('我已知晓应迁移旧缓存文件至新路径以避免现有账号数据无法读取。'),
      avoidCacheLossKeypath: $t('为了避免您现有账号的缓存丢失，{bold}将旧路径下的所有缓存文件手动迁移至新的缓存路径下。 ', { bold: '{bold}' }),
      mergeBookmarksWithEntity: $t('与账号中已有书签合并'),
      overwriteEntityBookmarks: $t('覆盖原账号中已有书签'),
      closeBrowserBeforeDirectoryChange: $t('请先关闭浏览器账号再执行此操作'),
      entityUsageCount: count => $t('{count}个账号用量', { count }),
      exceedsMaxCreatableEntities: $t('您在其他团队的可创建账号数加上当前设置的账号数，已超过账号本身的可创建账号的最大值。'),
      defaultEntityInfoExample: $t('默认账号信息会展示为团队名称的前三个字符与序号的组合'),
      entityInfoExample: name => $t('账号信息示例：{name}', { name }),
      selectEntityTooltip: $t('选择账号'),
    }
  }

  return {
    entity: $t('窗口'),
    open: $t('打开窗口'),
    close: $t('关闭窗口'),
    view: $t('查看窗口'),
    entityName: $t('窗口名称'),
    entityId: $t('窗口 ID'),
    entityIdExportOnly: $t('窗口 ID (仅导出用)'),
    exportEntities: $t('要导出的窗口:'),
    exportCookieTip: $t('*对于具有大量 cookie 的窗口，请选择 .txt 格式'),
    clearCachePartialNote: $t('清除扩展数据以外的所有本地缓存文件，{light}！窗口指纹信息、IP 不会被清理。', { light: '{light}' }),
    clearCacheAllNote: $t('清除所有本地缓存文件，{light}！窗口指纹信息、IP 不会被清理。', { light: '{light}' }),
    addRemarkTitle: $t('请为窗口添加备注'),
    selectedCookiesWarning: $t('所选窗口的所有 Cookie 都将被覆盖，请谨慎操作。'),
    closeEntity: $t('关闭窗口'),
    closeEntityAfterComplete: $t('开启后，执行完成或出现异常时自动关闭窗口'),
    cookieRobotHelp: $t('帮助新窗口生成浏览记录，降低被网站识别为异常环境的风险。'),
    cannotOpenDisk: $t('当前所在磁盘空间不足 {bold}，无法打开窗口。您可以前往软件设置中调整磁盘限制。', { bold: '{bold}' }),
    closeBeforeAction: $t('请先关闭窗口'),
    proxyExpiredBeforeOpen: $t('您购买的代理 IP 已过期。请在打开窗口前更新代理 IP 信息'),
    getStatusFailed: $t('获取窗口状态信息失败'),
    quotaInsufficientShort: $t('窗口额度不足'),
    quotaInsufficientContactOwner: $t('窗口额度不足，请联系空间的拥有者进行升级'),
    transferSingle: $t('转移窗口'),
    transferMultiple: count => $t('转移 {count} 个窗口', { count }),
    batchOpenAndArrange: count => $t('打开并排列 {count} 个窗口', { count }),
    relatedProfilesColumn: $t('已关联窗口'),
    deleteTagConfirmMessage: $t('您确认要删除所选标签吗？删除后，关联窗口的标签将被清除。'),
    entityRemark: $t('窗口备注'),
    entitySize: $t('窗口大小'),
    entityPosition: $t('窗口位置'),
    entityPositionTooltip: $t('窗口打开时在屏幕中的初始位置'),
    unnamedEntityPlaceholder: $t('未命名窗口(选填)'),
    syncExtensionApps: $t('同步扩展应用程序'),
    settingsPanelSubtitle: $t('窗口'),
    entityNum: $t('窗口编号'),
    entityDisplayName: $t('窗口名字'),
    openWorkbenchWhenOpen: $t('打开窗口时，是否打开工作台页面'),
    googleLoginEnableDesc: $t('窗口是否开启谷歌账号登录（火狐内核的窗口暂不支持此功能。）'),
    searchEngineWhenOpen: $t('打开窗口时，浏览器使用的默认搜索引擎'),
    batchOpenLayoutDesc: $t('批量打开窗口时，窗口的布局方式'),
    stopOpenWhenDiskLow: $t('磁盘空间低于设置的阈值时，将停止打开浏览器窗口'),
    stopOpenWhenMemoryLow: $t('内存使用达到设置的阈值时，将停止打开浏览器窗口'),
    clearCachePartialTooltipPlain: $t('清除扩展数据以外的所有本地缓存文件，登录状态不会失效！窗口指纹信息、IP 不会被清理。'),
    clearCacheAllTooltipPlain: $t('清除所有本地缓存文件，登录状态不会失效！窗口指纹信息、IP 不会被清理。'),
    clearUnusedEntityCacheDesc: $t('清除过去指定时间内未使用窗口的缓存数据'),
    clearUnusedEntityCacheKeypath: $t('清除过去{input}未使用窗口的缓存数据', { input: '{input}' }),
    customBookmarksPreferenceDesc: $t('窗口偏好设置中开启“自定义书签”功能生效'),
    autoRestoreEntity: $t('窗口自动恢复'),
    autoRestoreEntityDesc: $t('主动重启客户端后，恢复上次窗口打开状态'),
    restoreEntityNetworkChangeDesc: $t('自动恢复窗口前，若客户端网络环境变化'),
    continueRestoreEntity: $t('继续恢复窗口'),
    abortRestoreEntity: $t('终止恢复窗口'),
    closeAllEntitiesOnExit: $t('点击【继续】将关闭所有窗口并退出'),
    themeEntitySettingsNote: $t('您已调整客户端主题，可在【软件设置】中进一步设置浏览器窗口主题'),
    migrateCacheBeforeLaunch: $t('在修改缓存路径后，请您务必于再次启动窗口前'),
    existingEntityCachePathNote: $t('修改缓存路径后，现有窗口启动时将从新路径尝试读取缓存。'),
    migrateCacheAcknowledge: $t('我已知晓应迁移旧缓存文件至新路径以避免现有窗口数据无法读取。'),
    avoidCacheLossKeypath: $t('为了避免您现有窗口的缓存丢失，{bold}将旧路径下的所有缓存文件手动迁移至新的缓存路径下。 ', { bold: '{bold}' }),
    mergeBookmarksWithEntity: $t('与窗口中已有书签合并'),
    overwriteEntityBookmarks: $t('覆盖原窗口中已有书签'),
    closeBrowserBeforeDirectoryChange: $t('请先关闭浏览器窗口再执行此操作'),
    entityUsageCount: count => $t('{count}个窗口用量', { count }),
    exceedsMaxCreatableEntities: $t('您在其他团队的可创建窗口数加上当前设置的窗口数，已超过账号本身的可创建窗口的最大值。'),
    defaultEntityInfoExample: $t('默认窗口信息会展示为团队名称的前三个字符与序号的组合'),
    entityInfoExample: name => $t('窗口信息示例：{name}', { name }),
    selectEntityTooltip: $t('选择窗口'),
  }
}

/** 组件内按当前路由 workspace 类型读取文案 */
export function useProfileEntityLabels(): ComputedRef<ProfileEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createProfileEntityLabels(isEcommerce.value))
}
