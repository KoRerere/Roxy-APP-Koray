import type { UnwrapRowsType, UnwrapRowType, UserAddWindowInfoCreatePayload, UserGetPluginListListData, UserGetSystemPluginListData, UserGetUserConfigListData } from '@roxy/backend-api'
import type { LastMessage } from '#roxybrowser/modules/browser/browser-manager/beforeLaunchTask'
import type { WindowItemType } from '#roxybrowser/modules/browser/browser-manager/types'
import type { UserSelectedExtensionInfo } from '#roxybrowser/modules/extension'
import type { PluginMeta } from '#roxybrowser/modules/extension/helper'
import type { CheckLocalExtensionUpdatePayload, UploadExtensionToOSSResult } from '#roxybrowser/modules/extension/types'
import type { StoreType } from '#roxybrowser/modules/store'
import type { UpdateInfo } from '#roxybrowser/modules/updater'
import type { ProxyDetectionParams, ProxyDetectionResult } from '#roxybrowser/utils/proxyDetection'
import type { RandomFingerprint, RandomFingerprintFuncParameters, RandomFingerprintFuncReturnTypes } from '#roxybrowser/utils/randomFingerprint'
import type { FileFilter } from 'electron'
import type { ResourceUpdateMessage } from './mainMessage'

export interface RenderMessage {
  /** 批量启动窗口 */
  'browser:batchLaunch': (dirIds: string[]) => void
  /** 批量重启窗口 */
  'browser:batchRelaunch': (dirIds: string[]) => void
  /** 批量关闭窗口 */
  'browser:batchClose': (dirIds: string[]) => void
  /** 批量删除窗口 */
  'browser:batchRemove': (dirIds: string[]) => void
  /** 批量删除窗口 */
  'browser:getOpenedBrowser': () => LastMessage[]
  /** 清除浏览器缓存， */
  'browser:clearCache': (payload: { clearType: 'partial' | 'all', dirId: string }) => void

  /** 代理检测 */
  'proxy:detect': (proxyParams: ProxyDetectionParams) => ProxyDetectionResult
  /** 删除 luminet 代理 */
  'proxy:delLuminetProxy': (dirId: string) => void
  /** 检测本地网络/系统代理 */
  'proxy:detectNetwork': (type?: 'local' | 'system') => ProxyDetectionResult
  /** 获取系统代理 */
  'proxy:getSystemProxy': () => Promise<string>
  /** 代理 => 刷新 URL */
  'proxy:refreshUrl': (refreshUrl: string) => Promise<boolean>

  /** 保存用户信息 */
  'user:setUserInfo': (userInfo: { token: string, userId: number }) => void
  /** 用户退出登录 */
  'user:logout': () => void
  /** 切换空间时设置当前空间 ID  */
  'user:setWorkspaceId': (workspaceId: number) => void
  /** 用户上传头像  */
  'user:uploadAvatar': (avatarPath: string) => Promise<string>

  /** 选择文件夹 */
  'dialog:selectDir': (defaultPath?: string) => Promise<string>
  /** 选择文件 */
  'dialog:selectFile': (filters?: FileFilter[]) => Promise<string>

  /** 保存软件设置 */
  'app:saveSoftConfig': (config: Partial<UserGetUserConfigListData['data']>) => void
  /** 获取软件设置 */
  'app:getSoftConfig': () => StoreType
  /** 检测更新 */
  'app:checkForUpdates': () => Promise<UpdateInfo | undefined>
  /** 检测是否有更新 */
  'app:hasUpdate': () => Promise<boolean>
  /** 获取应用版本号 */
  'app:getAppVersion': () => string
  /** openapi 端口或开关变的时候，需要重启服务 */
  'app:restartAPIServer': () => void
  /** 安装并更新 */
  'app:quitAndInstall': (info: ResourceUpdateMessage) => any
  /** 获取所有可用的内核列表 */
  'app:getCoreList': () => ResourceUpdateMessage[]
  /** 下载指定内核 */
  'app:download-chrome-core': (coreVersion: string) => void
  /** 显示系统日志所在目录 */
  'app:showLogDir': () => void
  /** 获取本机 mac address */
  'app:getMacAddress': () => Promise<string>

  /** 下载指定插件 */
  'extension:download': (extensions: UnwrapRowsType<UserGetSystemPluginListData>) => void
  /** 删除指定插件 */
  'extension:remove': (extIDs: string[]) => void
  /** 获取并解析用户本地选择的插件信息 */
  'extension:getSelectedExtensionInfo': (selectType: 'dir' | 'file') => UserSelectedExtensionInfo
  /** 上传本地插件到 OSS */
  'extension:uploadExtensionToOSS': (payload: UnwrapRowType<UserGetPluginListListData>) => Promise<UploadExtensionToOSSResult>
  /** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
  'extension:checkLocalExtensionUpdate': (payload: CheckLocalExtensionUpdatePayload) => Promise<string[]>
  /** 获取本地已安装的插件 */
  'extension:getInstalledExtensions': () => Promise<PluginMeta[]>
  /** 生成 api key */
  'util:genApiKey': () => string

  /** 将本地绝对路径转为自定义媒体协议路径 */
  'util:toMediaPath': (pathname: string) => string
  /** 删除工作空间 */
  'util:removeWorkspace': (workspaceId: number) => void
  /** 删除项目 */
  'util:removeProject': (payload: { workspaceId: number, projectId: number }) => void
  /** 随机生成字体 */
  'util:genRandomFonts': () => string[]
  /** 生成随机指纹 */
  'util:genRandomFingerprint': (payload: Partial<UserAddWindowInfoCreatePayload>, count?: number) => RandomFingerprint
  /** 按需调用生成指纹函数 */
  'util:callRandomFingerprintFunc': (payload: Partial<RandomFingerprintFuncParameters>) => RandomFingerprintFuncReturnTypes
  /** AES-GCM 加密 */
  'util:encryptAESGCM': (payload: string) => string
  /** AES-GCM 解密 */
  'util:decryptAESGCM': (payload: string) => string
  /** 检查端口是否被占用, 返回值为可用的端口，返回的端口号与传入的端口号不一致的话，则可认为端口号被占用 */
  'util:checkPort': (port: number) => Promise<number>
  /** 获取网关配置 */
  'util:getGatewayConfig': () => Promise<string>

  /** 前端已准备就绪 */
  'web:ready': () => void
}
