import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, parse } from 'node:path'
import { app } from 'electron'
import { store } from '/@/modules/store'

/**
 * 获取安装程序路径
 * @returns 安装程序路径，如果文件不存在则返回 null
 */
export async function getInstallerPath(): Promise<string | null> {
  try {
    // 获取应用数据目录
    const appDataPath = app.getPath('userData')

    // 构建 installer-path 文件的完整路径
    const installerPathFile = join(appDataPath, 'installer-path')

    // 读取文件内容
    const content = await readFile(installerPathFile, 'utf-8')

    // 去除可能的换行符和空格
    return content.trim()
  } catch (error) {
    console.warn('Failed to read installer path file:', error)
    return null
  }
}

/**
 * 检查是否通过安装程序安装
 * @returns 如果是通过安装程序安装的返回 true，否则返回 false
 */
export async function isInstalledViaInstaller(): Promise<boolean> {
  const installerPath = await getInstallerPath()
  return installerPath !== null
}

/**
 * 获取安装程序文件名
 * @returns 安装程序文件名，如果无法获取则返回 null
 */
export async function getInstallerParams() {
  const installerPath = await getInstallerPath()
  if (!installerPath) return null

  try {
    const fileName = parse(installerPath).name.split('-H-')[1] || ''
    const [inviteCode, visitorId] = fileName.split('__')

    if (visitorId) {
      store.visitorId = visitorId
    }

    return {
      inviteCode,
      visitorId,
    }
  } catch {
    return null
  }
}

/**
 * 获取邀请码
 * @returns 邀请码
 */
export async function getInviteCode(): Promise<string> {
  const params = await getInstallerParams()
  return params?.inviteCode || ''
}

/**
 * 清空 installer-path 文件内容
 * @returns 操作是否成功
 */
export async function clearInstallerPath(): Promise<boolean> {
  try {
    const appDataPath = app.getPath('userData')
    const installerPathFile = join(appDataPath, 'installer-path')

    // 清空文件内容（写入空字符串）
    await writeFile(installerPathFile, '', 'utf-8')

    console.log('installer-path file content cleared')
    return true
  } catch (error) {
    console.error('Failed to clear installer-path file:', error)
    return false
  }
}
