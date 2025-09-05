import systeminformation, { Systeminformation } from 'systeminformation'
import { execSync } from 'node:child_process'
import { networkInterfaces, platform } from 'node:os'
import { parse } from 'node:path'

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

/** 获取本机系统磁盘信息 by path */
export async function getDiskInfoByPath(filePath: string) {
  const diskId = process.platform === 'win32' ? parse(filePath).root.replace(/\\/g, '') : '/'
  const disks = await getSystemDisks()

  return disks.find(disk => {
    if (process.platform === 'win32') {
      return disk.fs.toUpperCase().startsWith(diskId.toUpperCase());
    }
    return filePath.startsWith(disk.mount);
  })
}
