import type { UnwrapRowsType, UnwrapRowType, UserGetPluginListListData, UserGetSystemPluginListData, UserGetUserConfigListData } from '@roxy/backend-api'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'
import type { PluginMeta } from '#roxybrowser/modules/extension/helper'
import type { CheckLocalExtensionUpdatePayload, UploadExtensionToOSSResult } from '#roxybrowser/modules/extension/types'
import type { ProxyDetectionParams, ProxyDetectionResult } from '#roxybrowser/utils/proxyDetection'
import type { FileFilter } from 'electron'
import type { ResourceUpdateMessage } from './mainMessage'

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (winItemList: WindowItemType[]) => void
  /** 批量重启窗口 */
  'browser:batchRelaunch': (winItemList: WindowItemType[]) => void
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string[]) => void
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => void

  /** 代理检测 */
  'proxy:detect': (proxyParams: ProxyDetectionParams) => ProxyDetectionResult
  /** 检测本地网络/系统代理 */
  'proxy:detectNetwork': () => ProxyDetectionResult
  /** 获取系统代理 */
  'proxy:getSystemProxy': () => Promise<string>
  /** 代理 => 刷新 URL */
  'proxy:refreshUrl': (refreshUrl: string) => Promise<boolean>

  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: { token: string, userId: number }) => void
  /** 切换空间时设置当前空间 ID  */
  'user:setWorkspaceId': (workspaceId: number) => void
  /** 用户上传头像  */
  'user:uploadAvatar': (avatarPath: string) => Promise<string>

  /** 选择文件夹 */
  'dialog:selectDir': () => Promise<string>
  /** 选择文件 */
  'dialog:selectFile': (filters?: FileFilter[]) => Promise<string>

  /** 保存软件设置 */
  'app:saveSoftConfig': (config: UserGetUserConfigListData['data']) => void
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
  /** 获取本地已安装的插件 */
  'extension:getInstalledExtensions': () => Promise<PluginMeta[]>
  /** 生成 api key */
  'base:apikey': () => Promise<string>

  /** 将本地绝对路径转为自定义媒体协议路径 */
  'util:toMediaPath': (pathname: string) => string
  /** 删除工作空间 */
  'util:removeWorkspace': (workspaceId: number) => void
  /** 删除项目 */
  'util:removeProject': (payload: { workspaceId: number, projectId: number }) => void
  /** 随机生成字体 */
  'util:genRandomFonts': () => string[]

  /** 前端已准备就绪 */
  'web:ready': () => void
}
