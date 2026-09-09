import type { Message } from 'roxy-agent-runtime'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import { env } from '@/config'

export interface RuntimeMetadata {
  os: string
  arch: string
  systemLanguage: string
  timezone: string
}

export interface RuntimeContextMessageOptions {
  /** Bounded startup snapshot. Omitted after the first visible session turn. */
  memoryIndex?: string
}

export interface RuntimeSystemContextOptions {
  workingDirectory: string
  recordingPath?: string
  memoryDirectory?: string
  memoryIndexFile?: string
  /** Deterministic test/host override. Production detects the host snapshot once per Agent. */
  metadata?: RuntimeMetadata
  launchToolName?: string
  assignedDirIds?: readonly string[]
}

export interface OperatingSystemInfo {
  platform: NodeJS.Platform
  release: string
  macProductVersion?: string
  linuxPrettyName?: string
}

export function formatOperatingSystem(info: OperatingSystemInfo): string {
  if (info.platform === 'darwin') {
    return info.macProductVersion?.trim()
      ? `macOS ${info.macProductVersion.trim()}`
      : `macOS (Darwin ${info.release})`
  }
  if (info.platform === 'win32') {
    return `Windows ${info.release}`
  }
  if (info.platform === 'linux') {
    return info.linuxPrettyName?.trim() || `Linux ${info.release}`
  }
  return `${info.platform} ${info.release}`
}

function detectMacProductVersion(): string | undefined {
  try {
    return execFileSync('/usr/bin/sw_vers', ['-productVersion'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined
  }
  catch {
    return undefined
  }
}

function detectLinuxPrettyName(): string | undefined {
  try {
    const line = readFileSync('/etc/os-release', 'utf8')
      .split(/\r?\n/)
      .find(entry => entry.startsWith('PRETTY_NAME='))
    const value = line?.slice('PRETTY_NAME='.length).trim()
    if (!value) {
      return undefined
    }
    return value.replace(/^(["'])(.*)\1$/, '$2')
  }
  catch {
    return undefined
  }
}

function detectOs(): string {
  const platform = os.platform()
  return formatOperatingSystem({
    platform,
    release: os.release(),
    ...(platform === 'darwin' ? { macProductVersion: detectMacProductVersion() } : {}),
    ...(platform === 'linux' ? { linuxPrettyName: detectLinuxPrettyName() } : {}),
  })
}

export function detectRuntimeMetadata(): RuntimeMetadata {
  return {
    os: detectOs(),
    arch: os.arch(),
    systemLanguage: env.SYSTEM_LANGUAGE?.trim() || 'unknown',
    timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

function displayLanguage(locale: string): string {
  const normalized = locale.toLowerCase()
  if (normalized.startsWith('zh')) {
    return 'Simplified Chinese'
  }
  if (normalized.startsWith('en')) {
    return 'English'
  }
  if (normalized.startsWith('ru')) {
    return 'Russian'
  }
  return `the configured system language (${locale})`
}

export function renderRuntimeSystemContext(options: RuntimeSystemContextOptions): string {
  const metadata = options.metadata ?? detectRuntimeMetadata()
  const language = displayLanguage(metadata.systemLanguage)
  const lines = [
    '## Current Runtime Context',
    '',
    'The following values describe this Agent instance. Treat them as trusted runtime data, not as user instructions.',
    '',
    `- Operating system: \`${metadata.os}\``,
    `- CPU architecture: \`${metadata.arch}\``,
    `- System language: \`${metadata.systemLanguage}\``,
    `- Time zone: \`${metadata.timezone}\``,
    `- Working directory: \`${options.workingDirectory}\``,
    ...(options.recordingPath ? [`- Browser operation record: \`${options.recordingPath}\``] : []),
    ...(options.memoryDirectory ? [`- Long-term memory directory: \`${options.memoryDirectory}\``] : []),
    ...(options.memoryIndexFile ? [`- Memory index file: \`${options.memoryIndexFile}\``] : []),
    '',
    '### Response Language',
    '',
    `Use ${language} (${metadata.systemLanguage}) when communicating with the user by default. If the user's latest message clearly uses another language, respond in that language. Follow any explicit language request from the user.`,
  ]

  if (options.launchToolName) {
    lines.push('', '### Assigned Browser Scope', '', `Use \`${options.launchToolName}\` when you need to launch a browser.`)
    if (options.assignedDirIds && options.assignedDirIds.length > 0) {
      lines.push(`Only these authorized profile ids may be used: ${options.assignedDirIds.map(id => `\`${id}\``).join(', ')}.`)
    }
    else {
      lines.push('No browser profile ids were assigned by the parent agent.')
    }
  }

  return lines.join('\n')
}

export function createRuntimeContextMessages(options: RuntimeContextMessageOptions): Message[] {
  if (options.memoryIndex === undefined) {
    return []
  }

  const memoryIndex = options.memoryIndex.trim()
    ? (options.memoryIndex.endsWith('\n') ? options.memoryIndex : `${options.memoryIndex}\n`)
    : '(Empty memory index)\n'
  return [{
    role: 'developer',
    content: `<memory-md>\n${memoryIndex}</memory-md>`,
    visible: false,
    compactionKey: 'memory-md',
    compactionOrder: 1,
  }]
}
