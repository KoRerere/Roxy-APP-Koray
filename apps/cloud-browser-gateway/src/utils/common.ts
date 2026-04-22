import { access, mkdir, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import * as si from 'systeminformation'

/**
 * 文件或目录是否存在
 *
 * @param filePath 文件或目录路径
 * @param create 目录不存在时是否创建
 * @param rebuild 目录存在时是否重新创建
 */
export async function fileExists(filePath: string, create = false, rebuild = false) {
  try {
    await access(filePath)
    if (rebuild) {
      await rm(filePath, { recursive: true })
      await mkdir(filePath, { recursive: true })
    }
    return true
  }
  catch {
    if (create) {
      try {
        await mkdir(filePath, { recursive: true })
        return true
      }
      catch (error) {
        console.log('创建目录失败：', error)
        return false
      }
    }
    return false
  }
}

/** 获取可写目录，不可写时回退到默认目录 */
export async function getWritableDir(preferredDir: string, fallbackDir = path.resolve(process.cwd(), '.data', 'cloud-browser')) {
  try {
    await mkdir(preferredDir, { recursive: true })
    await access(preferredDir, constants.W_OK)
    return preferredDir
  }
  catch {
    await mkdir(fallbackDir, { recursive: true })
    return fallbackDir
  }
}

/** 获取本机 MAC 地址 */
export async function getMacAddress() {
  const networkData = await si.networkInterfaces()
  const list = Array.isArray(networkData) ? networkData : [networkData]
  return list.find((iface: { internal?: boolean; mac?: string }) => !iface.internal)?.mac || ''
}
