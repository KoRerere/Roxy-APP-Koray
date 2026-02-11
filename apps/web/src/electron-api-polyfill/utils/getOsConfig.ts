import { getUserAgentOs } from '/@/utils/basic'

export function getOsConfig() {
  const ua = navigator.userAgent
  const platform = navigator.platform
  const uaData = navigator.userAgentData

  /**
   * 'Windows', 'macOS', 'Linux', etc.
   */
  const osName = getUserAgentOs()

  let os = 'win32'
  let osVersion = '10'
  let cpu = 'intel'
  let osBit = '64'

  // 1. 探测操作系统
  if (osName === 'macOS' || /Mac/.test(platform)) {
    os = 'darwin'
  }
  else if (osName === 'Windows' || /Win/.test(platform)) {
    os = 'win32'
  }
  else if (osName === 'Linux' || /Linux/.test(platform)) {
    os = 'linux'
  }

  // 2. 探测系统版本 (模拟内核版本)
  if (os === 'win32') {
    // Windows: 返回主版本号。Win10/11 => 10
    if (/Windows NT 10.0/.test(ua))
      osVersion = '10'
    else if (/Windows NT 6.1/.test(ua))
      osVersion = '7'
    else if (/Windows NT 6.2/.test(ua))
      osVersion = '8'
    else if (/Windows NT 6.3/.test(ua))
      osVersion = '8'
    else if (/Windows NT 5.1/.test(ua))
      osVersion = '5' // XP
    else if (/Windows NT 6.0/.test(ua))
      osVersion = '6' // Vista
  }
  else if (os === 'darwin') {
    // macOS: 返回 Darwin 内核版本
    // 公式: (Major == 10 ? Minor + 4 : Major + 9)
    const match = ua.match(/Mac OS X (\d+)[_.](\d+)/)
    if (match) {
      const major = Number.parseInt(match[1], 10)
      const minor = Number.parseInt(match[2], 10)
      if (major === 10) {
        osVersion = String(minor + 4)
      }
      else {
        osVersion = String(major + 9)
      }
    }
  }

  // 3. 探测 CPU
  // 尝试探测 Apple Silicon
  if (os === 'darwin') {
    // 检查 "MacIntel"，但现代 Mac 通常会隐藏此信息。
    // 启发式：如果需要，可以检查更高的并发数或特定的 GPU 渲染器，
    // 但除非确信，否则通用的回退值 'intel' 对兼容性更安全。
    // 但是，用户明确要求区分 intel/apple。
    // 如果 userAgentData 架构可用且为 'arm'，则使用 apple。
    if (uaData?.architecture === 'arm') {
      cpu = 'apple'
    }
    else if (/Intel/.test(navigator.platform) || /Intel/.test(ua)) {
      cpu = 'intel'
    }
    // Apple Silicon 在 UA 中通常报告为 Intel，因此在没有 UA-CH 的情况下，'intel' 是安全的默认 polyfill
  }
  else {
    cpu = 'intel' // 在此上下文中 Windows/Linux 的默认值
  }

  // 4. 探测系统位数
  if (ua.includes('WOW64') || ua.includes('Win64') || ua.includes('x64')) {
    osBit = '64'
  }
  else if (platform === 'Win32') {
    // navigator.platform 'Win32' 也可能在 64 位 Windows 上，检查 UA
    osBit = '32'
  }

  return {
    os,
    osVersion,
    cpu,
    osBit,
  }
}
