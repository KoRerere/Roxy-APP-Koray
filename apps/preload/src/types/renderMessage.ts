import type { ResourceUpdateMessage } from './mainMessage'
import type {
  UnwrapRowsType,
  UnwrapRowType,
  UserAddWindowInfoV2CreatePayload,
  UserGetAppUpgradeCreateData,
  UserGetCoreUpgradeCreateData,
  UserGetSystemPluginListData,
  UserGetUserConfigListData,
} from '@roxy/backend-api'
import type { OsConfig } from '#roxybrowser/constants'
import type { LastMessage } from '#roxybrowser/modules/browser/browser-manager/beforeLaunchTask'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'
import type {
  UploadExtensionToOSSPayload,
  UserSelectedExtensionInfo,
} from '#roxybrowser/modules/extension'
import type { PluginMeta } from '#roxybrowser/modules/extension/helper'
import type {
  CheckLocalExtensionUpdatePayload,
  UploadExtensionToOSSResult,
} from '#roxybrowser/modules/extension/types'
import type { StoreType } from '#roxybrowser/modules/store'
import type { RoxySyncStartResult } from '#roxybrowser/modules/sync-control/bin'
import type { OpenPreferencesDialogPayload } from '#roxybrowser/modules/sync-control/dialog/preferences'
import type {
  PreferenceSettings,
  SyncControlAPIResponse,
  SyncControlDoLayoutPayload,
  SyncControlSendTextPayload,
  SyncControlSettings,
} from '#roxybrowser/modules/sync-control/model'
import type { ShortcutKeyRegisterResult } from '#roxybrowser/modules/sync-control/shortcutKey'
import type { UpdateInfo } from '#roxybrowser/modules/updater'
import type { CommonRequestHeaders, DeviceInfo } from '#roxybrowser/utils'
import type {
  ProxyDetectionParams,
  ProxyDetectionResult,
} from '#roxybrowser/utils/proxyDetection'
import type {
  RandomFingerprint,
  RandomFingerprintFuncParameters,
  RandomFingerprintFuncReturnTypes,
} from '#roxybrowser/utils/randomFingerprint'
import type { FileFilter, GPUFeatureStatus, NativeTheme } from 'electron'

interface ReGetUpdateInfoType {
  app: UserGetAppUpgradeCreateData
  kernel: UserGetCoreUpgradeCreateData
}

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (dirIds: string[]) => void
  /** 批量重启窗口 */
  'browser:batchRelaunch': (dirIds: string[]) => void
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string[]) => void
  /** 关闭所有窗口 */
  'browser:closeAll': () => void
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => void
  /** 获取已打开的窗口 */
  'browser:getOpenedBrowser': () => WindowItemType[]
  /** 获取已打开的窗口数量 */
  'browser:getOpenedBrowserCount': (targetWorkspaceId?: number) => number
  /** 获取已打开创建信息 */
  'browser:getOpenedBrowserMessage': () => LastMessage[]
  /** 清除浏览器缓存， */
  'browser:clearCache': (payload: {
    clearType: 'partial' | 'all'
    dirIds: string[]
  }) => void
  /** 根据时间清除浏览器缓存 */
  'browser:clearCacheByTimestamp': (payload: {
    days: number
    clearType: 'partial' | 'all'
  }) => void
  /** 根据进程 PID 判断进程是否存在 */
  'browser:isProcessExists': (dirIds: string[]) => Promise<boolean[]>
  /** 正在使用中的内核 */
  'browser:usingCores': () => string[]
  /** 设为默认浏览器 */
  'browser:setAsDefaultBrowser': (windowItem: WindowItemType) => void
  /** 获取默认浏览器 */
  'browser:getDefaultBrowser': () => string
  /** 创建桌面快捷方式 */
  'browser:createDesktopShortcut': (windowItem: WindowItemType) => void

  /** 代理检测 */
  'proxy:detect': (proxyParams: ProxyDetectionParams) => ProxyDetectionResult
  /** 删除 roxynet 代理 */
  'proxy:delRoxynetProxy': (dirId: string) => void
  /** 检测本地网络/系统代理 */
  'proxy:detectNetwork': (type?: 'local' | 'system') => ProxyDetectionResult
  /** 获取系统代理 */
  'proxy:getSystemProxy': () => Promise<string>
  /** 代理 => 刷新 URL */
  'proxy:refreshUrl': (refreshUrl: string) => Promise<boolean>

  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: { token: string, userId: number, workspaceId: number, userName: string, email: string }) => void
  /** 用户退出登录 */
  'user:logout': () => void
  /** 切换空间时设置当前空间 ID  */
  'user:setWorkspaceId': (workspaceId: number) => void
  /** 用户上传头像  */
  'user:uploadAvatar': (avatarPath: string) => Promise<string>
  /** 设置所有空间 ID */
  'user:setAllWorkspaceId': (workspaceIds: number[]) => void
  /** 设置公共空间列表 */
  'user:setSharedWorkspaceList': (workspaceList: { workspaceId: number, role: number }[]) => void

  /** 选择文件夹 */
  'dialog:selectDir': (defaultPath?: string) => Promise<string>
  /** 选择文件 */
  'dialog:selectFile': (filters?: FileFilter[]) => Promise<string>

  /** 开启系统代理 */
  'app:setProxy': (payload: { proxyRules?: string, proxyBypassRules?: string }) => void
  /** 关闭系统代理 */
  'app:removeProxy': () => void
  /** 获取系统代理信息 */
  'app:getSystemProxyInfo': () => Promise<{
    address: string
    isEnabled: boolean
    proxyRules: string
  }>

  /** 保存软件设置 */
  'app:saveSoftConfig': (
    config: Partial<UserGetUserConfigListData['data'] & StoreType>,
  ) => void
  /** 获取软件设置 */
  'app:getSoftConfig': () => StoreType
  /** 重新拉起远程软件设置 */
  'app:fetchSoftConfig': () => void
  /** 重新获取更新信息，如：APP、内核等版本升级信息 */
  'app:reGetUpdateInfo': <T extends keyof ReGetUpdateInfoType>(
    type: T,
  ) => ReGetUpdateInfoType[T]
  /** 检测 APP 更新 */
  'app:checkForUpdates': () => Promise<UpdateInfo | undefined>
  /** 检测 WEB 更新 */
  'app:checkWebForUpdates': () => Promise<void>
  /** 检测是否有更新 */
  'app:hasUpdate': () => Promise<boolean>
  /** 获取应用版本号 */
  'app:getAppVersion': () => string
  /** 卸载反馈已提交 */
  'app:uninstall-feedback-submitted': (payload: { reasons: number[], feedback: string }) => Promise<void>
  /** 跳过卸载反馈 */
  'app:uninstall-feedback-skipped': () => Promise<void>
  /** 直接卸载，无需反馈 */
  'app:uninstall-directly': () => Promise<void>
  /** 打开外部链接 */
  'app:open-external-url': (url: string) => Promise<void>
  /** 取消卸载 */
  'app:uninstall-cancelled': () => Promise<void>
  /** openapi 端口或开关变的时候，需要重启服务 */
  'app:restartAPIServer': () => void
  /** 安装并更新 */
  'app:quitAndInstall': (info: Partial<ResourceUpdateMessage>) => any
  /** 获取所有可用的内核列表 */
  'app:getCoreList': () => ResourceUpdateMessage[]
  /** 下载指定内核 */
  'app:download-chrome-core': (coreVersion: string) => void
  /** 删除指定内核 */
  'app:delete-chrome-core': (coreVersion: string) => void
  /** 显示 RoxyBrowser 缓存所在目录 */
  'app:showCacheDir': () => void
  /** 显示系统日志所在目录 */
  'app:showLogDir': () => void
  /** 获取本机 mac address */
  'app:getMacAddress': () => Promise<string>
  /** 获取浏览器缓存所在磁盘 */
  'app:getRoxyCacheDiskInfo': () => Promise<any>
  /** 获取浏览器缓存文件夹大小 */
  'app:getRoxyCacheSize': () => Promise<any>
  /** 程序化显示和隐藏红绿灯 */
  'app:showHideTrafficLight': (show: boolean) => void
  /** 设置窗口是否忽略鼠标事件 */
  'app:set-ignore-mouse-events': (
    ignore: boolean,
    options?: { forward: boolean },
  ) => void
  /** 当前 APP 窗口是否是主窗口 */
  'app:isMainWindow': () => boolean
  /** 显示当前网页所在的窗口 */
  'app:showCurrentWebviewWindow': () => void
  /** 开始移动窗口 */
  'app:startMoveWindow': () => void
  /** 停止移动窗口 */
  'app:stopMoveWindow': () => void
  /** 获取系统 GPU 信息 */
  'app:getGPUFeatureStatus': () => GPUFeatureStatus
  /** 动态设置窗口大小 */
  'app:resizeWindow': (payload: { width?: number, height?: number }) => void
  /** 获取新功能提示，不为空数组表示有新功能提示 */
  'app:getNewFeatureTips': () => string[]
  /** 用户已读新功能提示 */
  'app:hideNewFeatureTips': () => void
  /** 设置系统主题 */
  'app:setSystemTheme': (theme: NativeTheme['themeSource']) => void
  /** 是否显示长时间未登录提示 */
  'app:isShowLongTimeNotLoginTips': () => boolean

  /** 下载指定插件 */
  'extension:download': (
    extensions: UnwrapRowsType<UserGetSystemPluginListData>,
  ) => PromiseSettledResult<string>[]
  /** 删除指定插件 */
  'extension:remove': (extIDs: string[]) => void
  /** 获取并解析用户本地选择的插件信息 */
  'extension:getSelectedExtensionInfo': (
    selectType: 'dir' | 'file',
  ) => UserSelectedExtensionInfo
  /** 上传本地插件到 OSS */
  'extension:uploadExtensionToOSS': (
    payload: UploadExtensionToOSSPayload,
  ) => Promise<UploadExtensionToOSSResult>
  /** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
  'extension:checkLocalExtensionUpdate': (
    payload: CheckLocalExtensionUpdatePayload,
  ) => Promise<string[]>
  /** 获取本地已安装的插件 */
  'extension:getInstalledExtensions': () => Promise<PluginMeta[]>
  /** 根据插件 ID 获取插件信息 */
  'extension:getExtensionInfo': (extID: string) => Promise<PluginMeta>
  /** 显示插件所在文件夹 */
  'extension:showExtensionDir': (extID: string) => void
  /** 生成 api key */
  'util:genApiKey': () => string

  /** 将本地绝对路径转为自定义媒体协议路径 */
  'util:toMediaPath': (pathname: string) => string
  /** 删除工作空间 */
  'util:removeWorkspace': (workspaceId: number) => void
  /** 删除项目 */
  'util:removeProject': (payload: {
    workspaceId: number
    projectId: number
  }) => void
  /** 随机生成字体 */
  'util:genRandomFonts': () => string[]
  /** 生成随机指纹 */
  'util:genRandomFingerprint': (
    payload: Partial<UserAddWindowInfoV2CreatePayload>,
    count?: number,
  ) => RandomFingerprint
  /** 按需调用生成指纹函数 */
  'util:callRandomFingerprintFunc': (
    payload: Partial<RandomFingerprintFuncParameters>,
  ) => RandomFingerprintFuncReturnTypes
  /** AES-GCM 加密 */
  'util:encryptAESGCM': (payload: string) => string
  /** AES-GCM 解密 */
  'util:decryptAESGCM': (payload: string) => string
  /** 检查端口是否被占用, 返回值为可用的端口，返回的端口号与传入的端口号不一致的话，则可认为端口号被占用 */
  'util:checkPort': (port: number) => Promise<number>
  /** 获取网关配置 */
  'util:getGatewayConfig': () => Promise<string>
  /** 根据 ip 变化重新获取网关配置 */
  'util:reGetGatewayConfigByIpChange': (ip: string) => void
  /** 获取公共请求头部 */
  'util:getCommonRequestHeaders': () => CommonRequestHeaders
  /** 获取推广计划进来的用户的邀请码 */
  'util:getInviteCode': () => Promise<string>
  /** 获取设备唯一 ID */
  'util:getDeviceId': () => Promise<string>
  /** 获取设备信息 */
  'util:getDeviceInfo': () => Promise<DeviceInfo>
  /** 检测某个快捷键是否被占用 */
  'util:checkShortcutKeysIsOccupied': (payload: string) => Promise<boolean>
  /** 获取系统信息 */
  'util:getSystemInfo': () => {
    language: string
    UTCOffsetHours: number
  }
  /** 清空安装程序路径 */
  'util:clearInstallerPath': () => Promise<boolean>

  /** 前端已准备就绪 */
  'web:ready': () => void

  /** 窗口同步器相关 */
  /** 打开窗口同步器 */
  'syncControl:open': (isOwner?: boolean) => void
  /** 关闭窗口同步器 */
  'syncControl:close': () => void
  /** 开始同步窗口 */
  'syncControl:start': (dirIds: string[]) => void
  /** 停止同步窗口 */
  'syncControl:stop': (isShowSyncingWindowListDialog?: boolean) => void
  /** 销毁顶部操作栏 */
  'syncControl:destroyActionBar': () => void
  /** 宫格布局、堆叠布局、自定义布局 */
  'syncControl:doLayout': (
    payload: SyncControlDoLayoutPayload,
  ) => Promise<SyncControlAPIResponse>
  /**
   * 批量输入文本
   *
   * body参数格式
    {
      "mode":xx(string),
      "data":xxx(string)
    }

    当mode为same的时候，表示所有窗口使用相同文本，data为文本内容
    当mode为diff的时候，表示每个窗口使用不同的内容，data为每个窗口的内容,用dict表示,可以为pid,value为文本内容，例如：
    {
      "10000":"aaaa",
      "10002":"bbbb"
    }

    当mode为random的时候,表示随机生成，data为随机策略，格式为dict,
    {
      // 随机范围 -- 注意传入的是string类型
      "min":"111",
      "max":"2222",
    }
   */
  'syncControl:batchInputText': (
    payload: SyncControlSendTextPayload,
  ) => Promise<SyncControlAPIResponse>
  /** 显示所有窗口 */
  'syncControl:showAll': () => Promise<SyncControlAPIResponse>
  /** 动态修改同步设置 */
  'syncControl:changeSyncSettings': (
    settings: SyncControlSettings,
  ) => Promise<SyncControlAPIResponse>
  /** 打开偏好设置弹窗 */
  'syncControl:openPreferencesDialog': (
    payload?: OpenPreferencesDialogPayload,
  ) => void
  /** 关闭偏好设置弹窗 */
  'syncControl:closePreferencesDialog': () => void
  /** 动态改变偏好设置弹窗大小 */
  'syncControl:resizePreferencesDialog': (payload: {
    width?: number
    height: number
  }) => void
  /** 获取当前同步窗口的个数 */
  'syncControl:getSyncWindowCount': () => number
  /** 打开自定义布局弹窗 */
  'syncControl:openCustomLayoutDialog': () => void
  /** 关闭自定义布局弹窗 */
  'syncControl:closeCustomLayoutDialog': () => void
  /** 获取同步器启动返回的结果 */
  'syncControl:getSyncStartResult': () => RoxySyncStartResult
  /** 打开批量输入文本弹窗 */
  'syncControl:openBatchInputsDialog': () => void
  /** 关闭批量输入文本弹窗 */
  'syncControl:closeBatchInputsDialog': () => void
  /** 动态改变匹配输入文本弹窗大小 */
  'syncControl:resizeBatchInputsDialog': (payload: {
    width: number
    height: number
  }) => void
  /** 获取主控浏览器大小 */
  'syncControl:getMainControlBrowserSize': () => Promise<
    { width: number, height: number } | undefined
  >
  /** 统一标签页 */
  'syncControl:unifyTabs': () => void
  /** 关闭其他标签页 */
  'syncControl:closeOtherTabs': () => void
  /** 关闭当前标签页 */
  'syncControl:closeCurrentTab': () => void
  /** 关闭空白标签页 */
  'syncControl:closeBlankTabs': () => void
  /** 打开网址 */
  'syncControl:openSites': (payload: {
    urls: string[]
    replaceCurrentTab: boolean
  }) => void
  /** 关闭打开网址弹窗 */
  'syncControl:closeOpenSitesDialog': () => void
  /** 打开 打开网址弹窗 */
  'syncControl:openOpenSitesDialog': () => void
  /** 显示所有正在同步的窗口列表弹窗 */
  'syncControl:openSyncingWindowListDialog': () => void
  /** 关闭所有正在同步的窗口列表弹窗 */
  'syncControl:closeSyncingWindowListDialog': () => void
  /** 获取主控窗口 dirId */
  'syncControl:getMainControlDirId': () => string | undefined
  /** 获取所有群控中的窗口 */
  'syncControl:getAllSyncingWindows': () => WindowItemType[]
  /** 注册快捷键 */
  'syncControl:registerShortcut': (
    payload: PreferenceSettings['shortcutKey'],
  ) => Promise<ShortcutKeyRegisterResult>
  /** 检测快捷键是否被占用 */
  'syncControl:checkShortcutKeysIsOccupied': (
    payload: Partial<PreferenceSettings['shortcutKey']>,
  ) => Promise<ShortcutKeyRegisterResult>
  /** 暂停同步 */
  'syncControl:pause': () => void
  /** 恢复同步 */
  'syncControl:resume': () => void

  /** 打开 MCP */
  'mcp:open': () => void
  /** 获取 MCP 配置 */
  'mcp:config': () => Promise<{ port: number }>
  /** 关闭 MCP */
  'mcp:close': () => void
}
