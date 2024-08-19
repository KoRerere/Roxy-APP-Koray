import { execSync } from 'node:child_process'
import { platform } from 'node:os'

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
