import { arch, platform, release } from 'node:os'

/** 当前系统信息 */
export const osConfig = {
  /** 当前系统平台 darwin 或 win32 */
  os: platform(),
  /** 操作系统版本 11，10，8，7 */
  osVersion: release().split('.')[0],
  /** mac专用：intel/apple */
  cpu: arch() === 'x64' ? 'intel' : 'apple',
  /** win专用 操作系统位数 32或64 */
  osBit: arch() === 'x64' ? '64' : '32',
} as const

export type OsConfig = typeof osConfig
