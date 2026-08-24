import { basename } from 'node:path'

export type ShellType = 'bash' | 'zsh' | 'sh' | 'powershell' | 'cmd'

export interface ResolvedShell {
  type: ShellType
  path: string
}

function hostPlatform(): NodeJS.Platform {
  return process.platform
}

function defaultUnixShellPath(type: Extract<ShellType, 'bash' | 'zsh' | 'sh'>): string {
  return type === 'bash' ? '/bin/bash' : type === 'zsh' ? '/bin/zsh' : '/bin/sh'
}

function shellBasename(shell: string): string {
  return basename(shell).toLowerCase()
}

export function defaultShellForHost(platform: NodeJS.Platform = hostPlatform()): ResolvedShell {
  if (platform === 'win32') {
    return { type: 'cmd', path: process.env.ComSpec || 'cmd.exe' }
  }
  return { type: 'bash', path: '/bin/bash' }
}

export function resolveRequestedShell(shell?: string, platform: NodeJS.Platform = hostPlatform()): ResolvedShell {
  if (!shell) {
    return defaultShellForHost(platform)
  }

  const requested = shell.trim()
  if (!requested) {
    return defaultShellForHost(platform)
  }

  const name = shellBasename(requested)
  if (name === 'bash' || name === 'zsh' || name === 'sh') {
    return {
      type: name,
      path: requested.includes('/') || requested.includes('\\') ? requested : defaultUnixShellPath(name),
    }
  }
  if (name === 'pwsh' || name === 'pwsh.exe' || name === 'powershell' || name === 'powershell.exe') {
    return { type: 'powershell', path: requested }
  }
  if (name === 'cmd' || name === 'cmd.exe') {
    return { type: 'cmd', path: requested }
  }

  throw new Error(`unsupported shell: ${shell}`)
}

export function buildShellCommand(
  shell: ResolvedShell,
  command: string,
  login: boolean,
): { file: string; args: string[]; shell: false } {
  if (shell.type === 'bash' || shell.type === 'zsh' || shell.type === 'sh') {
    return { file: shell.path, args: [login ? '-lc' : '-c', command], shell: false }
  }
  if (shell.type === 'powershell') {
    return {
      file: shell.path,
      args: login ? ['-Command', command] : ['-NoProfile', '-Command', command],
      shell: false,
    }
  }
  return { file: shell.path, args: ['/c', command], shell: false }
}
