import type { UnwrapRowType, UnwrapRowsType, UserGetPluginListListData, UserGetSystemPluginListData, UserGetUserConfigListData } from '@roxy/backend-api'
import type { ResourceUpdateMessage } from './mainMessage'
import type { ProxyDetectionResult } from '#roxybrowser/utils/proxyDetection'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'
import type { CheckLocalExtensionUpdatePayload, UploadExtensionToOSSResult } from '#roxybrowser/modules/extension/types'

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (winItemList: WindowItemType[]) => any
  /** 批量重启窗口 */
  'browser:batchRelaunch': (winItemList: WindowItemType[]) => any
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string[]) => void
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => void

  /** 代理检测 */
  'proxy:detection': (winItemList: WindowItemType) => ProxyDetectionResult
  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: any) => void

  /** 保存软件设置 */
  'app:saveSoftConfig': (config: UserGetUserConfigListData['data']) => void
  /** 选择文件夹 */
  'dialog:selectDir': () => Promise<string>
  /** 检测更新 */
  'app:checkUpdate': () => Promise<boolean>
  /** 安装并更新 */
  'app:quitAndInstall': (info: ResourceUpdateMessage) => any
  /** 获取所有可用的内核列表 */
  'app:getCoreList': () => Promise<ResourceUpdateMessage[]>
  /** 下载指定内核 */
  'app:download-chrome-core': (coreVersion: string) => void
  /** 显示系统日志所在目录 */
  'app:showLogDir': () => void
  /** 获取本机 mac address */
  'app:getMacAddress': () => string

  /** 下载指定插件 */
  'extension:download': (extensions: UnwrapRowsType<UserGetSystemPluginListData>) => void
  /** 删除指定插件 */
  'extension:remove': (extIDs: string[]) => void
  /** 获取并解析用户本地选择的插件信息 */
  'extension:getSelectedExtensionInfo': (selectType: 'dir' | 'file') => any
  /** 上传本地插件到 OSS */
  'extension:uploadExtensionToOSS': (payload: UnwrapRowType<UserGetPluginListListData>) => Promise<UploadExtensionToOSSResult>
  /** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
  'extension:checkLocalExtensionUpdate': (payload: CheckLocalExtensionUpdatePayload) => Promise<string[]>
}
