import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

const nativeBinding = (() => {
  if (process.platform !== 'win32') {
    return
  }
  try {
    const devPath = '@roxy/diskspace-native/diskspace-native.win32-x64-msvc.node'
    const unpackPath = join(process.resourcesPath, 'node_modules', devPath)
    return require(app.isPackaged ? unpackPath : devPath)
  }
  catch (e) {
    console.error('Failed to load native binding diskspace-native.win32-x64-msvc.node', e)
  }
})()

export interface DiskSpace {
  /** 总大小（字节） */
  size: number
  /** 已使用大小（字节） */
  used: number
  /** 可用（空闲）大小（字节） */
  available: number
  /** 使用率百分比（0-100） */
  use: number
}

/**
 * 使用原生 Windows API 获取指定路径的磁盘空间信息。
 * 高性能，无需派生进程。
 */
export function getDiskSpace(pathOrDrive: string): DiskSpace {
  if (process.platform !== 'win32') {
    throw new Error('getDiskSpace is only supported on Windows')
  }

  // diskspace-native 处理逻辑，但返回 { available, total, free } (f64/number)
  // 我们需要将其映射到我们的接口。
  try {
    const { getDiskSpace: getDiskSpaceNative } = nativeBinding
    const info = getDiskSpaceNative(pathOrDrive)

    // 计算已使用和百分比
    // 注意：Rust 返回 available, total, free。
    // 我们需要 size=total, used=total-available, available=available, use=percentage

    // info.total, info.available 现在应该是数字。
    const used = info.total - info.available

    let use = 0
    if (info.total > 0) {
      use = (used / info.total) * 100
    }

    return {
      size: info.total,
      used,
      available: info.available,
      use,
    }
  }
  catch (err) {
    throw new Error(`Failed to get disk space for path: ${pathOrDrive}. Error: ${err}`)
  }
}
