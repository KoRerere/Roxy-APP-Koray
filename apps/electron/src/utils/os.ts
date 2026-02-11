import type { Systeminformation } from 'systeminformation'
import { exec, execSync } from 'node:child_process'
import { networkInterfaces, platform } from 'node:os'
import { parse } from 'node:path'
import systeminformation from 'systeminformation'
import { getDiskSpace } from './win32-disk'

/** 获取操作系统版本 */
export function getOSVersion(): string {
  try {
    if (platform() === 'win32') {
      // Windows 系统
      const output = execSync('wmic os get Caption').toString()
      const match = output.match(/Caption\s*(.+)/)
      return match ? match[1].trim() : 'Unknown Windows version'
    }
    else if (platform() === 'darwin') {
      // macOS 系统
      const output = execSync('sw_vers -productVersion').toString()
      return `macOS ${output.trim()}`
    }
    else if (platform() === 'linux') {
      // Linux 系统
      const output = execSync('lsb_release -d').toString()
      const match = output.match(/Description:\s*(.+)/)
      return match ? match[1].trim() : 'Unknown Linux version'
    }
    else {
      return 'Unknown OS'
    }
  }
  catch (error) {
    console.error('Error fetching OS version:', error)
    return 'Unknown OS version'
  }
}

/** 获取本机 MAC 地址 */
export async function getMacAddress() {
  const networkData = await systeminformation.networkInterfaces()
  return ([] as Systeminformation.NetworkInterfacesData[]).concat(networkData).find(iface => !iface.internal)?.mac || ''
}

/** 获取本机系统磁盘 */
function getSystemDisks() {
  return systeminformation.fsSize()
}

function getMacDiskInfo(filePath: string) {
  return new Promise<Partial<Systeminformation.FsSizeData>>((resolve) => {
    exec(`df -P "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Failed to execute df command: ${error}`)
        return resolve({ error: error.message })
      }

      const lines = stdout.trim().split('\n')
      if (lines.length < 2) {
        return resolve({ error: '无法解析 df 命令输出' })
      }

      const data = lines[1].trim().split(/\s+/)
      const totalBlocks = Number.parseInt(data[1])
      const usedBlocks = Number.parseInt(data[2])
      const availableBlocks = Number.parseInt(data[3])
      const totalBytes = totalBlocks * 512
      const usedBytes = usedBlocks * 512
      const availableBytes = availableBlocks * 512
      const usageRatio = totalBytes > 0 ? Math.floor((usedBytes / totalBytes) * 10000) / 100 : 0

      resolve({
        size: totalBytes,
        used: usedBytes,
        available: availableBytes,
        use: usageRatio,
      })
    })
  })
}

/** 获取本机系统磁盘信息 by path */
export async function getDiskInfoByPath(filePath: string) {
  if (process.platform === 'win32') {
    try {
      const diskInfo = getDiskSpace(filePath)
      console.debug('win32 diskInfo', diskInfo)
      return {
        ...diskInfo,
        fs: filePath.substring(0, 2).toUpperCase(), // Drive letter e.g. "C:"
        type: 'NTFS', // Assumption or need another API, but usually sufficient
        mount: filePath.substring(0, 2).toUpperCase(),
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  if (process.platform === 'darwin') {
    return getMacDiskInfo(filePath)
  }

  // Linux or others fallback
  const diskId = parse(filePath).root.replace(/\\/g, '')
  const disks = await getSystemDisks()
  return disks.find(disk => disk.fs.toUpperCase().startsWith(diskId.toUpperCase()))
}
