import { join } from 'node:path'

export const OPEN_URLS_FILE = join(__dirname, '../../config', 'open-urls.json')
export const WHITE_LIST_FILE = join(__dirname, '../../config', 'white-list.json')

export const commonRequestHeaders = {
  'source': 'web',
  'appVersion': '3.7.7',
  'osVersion': '6',
  'R-OS': 'linux',
  'R-OSBIT': '64',
  'R-DEVICE-NAME': 'buqiyuan',
  'R-Local-Timezone-Offset': 'Asia/Shanghai',
  'R-Local-System-Language': 'zh-CN',
  'language': 'zh-CN',
}

export const commonHeaders = commonRequestHeaders

export const isMac = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'
const platformToOs: Partial<Record<NodeJS.Platform, 'macos' | 'windows' | 'linux'>> = {
  darwin: 'macos',
  win32: 'windows',
  linux: 'linux',
}

/** 当前操作系统 */
export const currentOS: 'macos' | 'windows' | 'linux' = platformToOs[process.platform] ?? 'linux'
