import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * 跨平台敏感路径黑名单。
 *
 * 设计目标：在「放开脚本/enhance agent 读写外部文件系统」的前提下，仅拦截操作系统
 * 敏感目录与用户凭据/密钥目录，其余宿主路径一律放行（白名单放行语义）。命中黑名单的
 * fs 操作由调用方抛 `EACCES`，使脚本感知被拒并可用 try/catch 处理。
 *
 * 覆盖范围（本轮）：
 * - 系统目录：Unix 的 /etc /sys /proc /boot /dev /usr /bin /sbin /lib* /var/log /var/lib /root；
 *   Windows 的 %SystemDrive%\Windows、\Program Files、\Program Files (x86)、\ProgramData、
 *   \System Volume Information、\$Recycle.Bin。
 * - 用户凭据/密钥目录：~/.ssh ~/.aws ~/.gnupg ~/.kube ~/.docker ~/.password-store，以及 ~/.netrc。
 *
 * 不覆盖（本轮按用户决策）：RoxyBrowser 自身数据目录、普通用户家目录（需放行以便读写
 * ~/Downloads、~/Desktop 等用户文件）。如后续需扩展，在 buildSensitiveRoots 增补即可。
 *
 * 防绕过：黑名单前缀与目标路径都尽量用 realpath 解析后再比较（应对符号链接，如 macOS
 * /etc → /private/var 等）；realpath 失败时退回 normalize 后的绝对路径作保守字面比较。
 */

const isWin = process.platform === 'win32'

/** 把路径解析为真实绝对路径；realpath 失败（路径不存在等）时退回 normalize 结果。 */
function resolveReal(p: string): string {
  const resolved = path.resolve(p)
  try {
    return fs.realpathSync(resolved)
  }
  catch {
    return resolved
  }
}

/** 去除尾部路径分隔符，便于前缀比较（/etc/ 与 /etc 等价）。 */
function stripTrailingSep(p: string): string {
  if (p.length > 1 && p.endsWith(path.sep))
    return p.slice(0, -1)
  return p
}

/**
 * 构造当前平台的敏感路径前缀（真实绝对路径，已 realpath + 去重）。
 * 模块加载时计算一次；运行时只读比较。
 */
function buildSensitiveRoots(): string[] {
  const raw: string[] = []
  const home = os.homedir()

  if (isWin) {
    const sysDrive = (process.env.SystemDrive || 'C:').replace(/[/\\]$/, '')
    raw.push(
      `${sysDrive}\\Windows`,
      `${sysDrive}\\Program Files`,
      `${sysDrive}\\Program Files (x86)`,
      `${sysDrive}\\ProgramData`,
      `${sysDrive}\\System Volume Information`,
      `${sysDrive}\\$Recycle.Bin`,
    )
    // Windows 凭据存储
    raw.push(
      path.join(home, '.ssh'),
      path.join(home, '.aws'),
      path.join(home, '.gnupg'),
      path.join(home, '.kube'),
      path.join(home, '.docker'),
      path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Credentials'),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'Credentials'),
    )
  }
  else {
    // Unix 系统目录
    raw.push('/etc', '/sys', '/proc', '/boot', '/dev', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/var/log', '/var/lib', '/root')
    // macOS：/etc /var 等是 /private 下符号链接，realpath 后落到 /private/...，显式补齐保险
    if (process.platform === 'darwin') {
      raw.push('/private/etc', '/private/var/log', '/private/var/lib', '/private/var/db')
    }
    // 用户凭据/密钥目录
    raw.push(
      path.join(home, '.ssh'),
      path.join(home, '.aws'),
      path.join(home, '.gnupg'),
      path.join(home, '.kube'),
      path.join(home, '.docker'),
      path.join(home, '.password-store'),
      path.join(home, '.netrc'),
    )
  }

  // realpath 解析每个前缀（防符号链接）+ 去尾分隔符 + 去重
  const seen = new Set<string>()
  const resolved: string[] = []
  for (const r of raw) {
    const real = stripTrailingSep(resolveReal(r))
    if (!seen.has(real)) {
      seen.add(real)
      resolved.push(real)
    }
  }
  return resolved
}

const sensitiveRoots = buildSensitiveRoots()

export interface SensitivePathCheck {
  blocked: boolean
  /** 命中的敏感根路径（blocked=true 时有值，便于错误信息说明） */
  reason?: string
}

/**
 * 判定一个（已解析为绝对路径的）目标路径是否落入敏感黑名单。
 *
 * @param targetPath 任意路径，内部会 path.resolve + realpath 解析后再比较
 * @returns blocked=true 表示命中，应拒绝访问
 */
export function isSensitivePath(targetPath: string): SensitivePathCheck {
  const real = stripTrailingSep(resolveReal(targetPath))
  for (const root of sensitiveRoots) {
    if (real === root || real.startsWith(root + path.sep)) {
      return { blocked: true, reason: root }
    }
  }
  return { blocked: false }
}

/**
 * 展开路径开头的 `~` 为真实用户 home 目录。
 * sandbox 放开后脚本可能用 `~/Downloads/x` 访问用户文件，需先展开再解析。
 */
export function expandTilde(p: string): string {
  if (p === '~')
    return os.homedir()
  if (p.startsWith('~/') || p.startsWith('~\\'))
    return path.join(os.homedir(), p.slice(2))
  return p
}

/** 仅供测试/调试：返回当前生效的敏感根列表（不要在热路径调用）。 */
export function listSensitiveRoots(): string[] {
  return [...sensitiveRoots]
}
