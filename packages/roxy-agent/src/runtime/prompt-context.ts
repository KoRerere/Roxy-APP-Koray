import type { Message } from 'roxy-agent-runtime'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import { env } from '@/config'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function xmlElement(name: string, value: string): string {
  return `<${name}>${escapeXml(value)}</${name}>`
}

export interface RuntimeMetadata {
  os: string
  arch: string
  systemLanguage: string
  timezone: string
}

export interface RuntimeContextMessageOptions {
  workingDirectory: string
  recordingPath?: string
  memoryDirectory?: string
  memoryIndexFile?: string
  /** Bounded startup snapshot. Omitted after the first visible session turn. */
  memoryIndex?: string
  /** Deterministic test/host override. Production detects a fresh snapshot for each turn. */
  metadata?: RuntimeMetadata
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

function detectRuntimeMetadata(): RuntimeMetadata {
  return {
    os: detectOs(),
    arch: os.arch(),
    systemLanguage: env.SYSTEM_LANGUAGE?.trim() || 'unknown',
    timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

export function createRuntimeMetadataMessage(options: RuntimeContextMessageOptions): Message {
  const metadata = options.metadata ?? detectRuntimeMetadata()
  const content = [
    '<metadata>',
    `  ${xmlElement('os', metadata.os)}`,
    `  ${xmlElement('arch', metadata.arch)}`,
    `  ${xmlElement('system-lang', metadata.systemLanguage)}`,
    `  ${xmlElement('timezone', metadata.timezone)}`,
    `  ${xmlElement('cwd', options.workingDirectory)}`,
    ...(options.recordingPath ? [`  ${xmlElement('browser_ops_record', options.recordingPath)}`] : []),
    ...(options.memoryDirectory ? [`  ${xmlElement('memory_directory', options.memoryDirectory)}`] : []),
    ...(options.memoryIndexFile ? [`  ${xmlElement('memory_index_file', options.memoryIndexFile)}`] : []),
    '</metadata>',
  ].join('\n')

  return {
    role: 'developer',
    content,
    visible: false,
    compactionKey: 'metadata',
    compactionOrder: 0,
  }
}

export function createRuntimeContextMessages(options: RuntimeContextMessageOptions): Message[] {
  const messages = [createRuntimeMetadataMessage(options)]
  if (options.memoryIndex !== undefined) {
    const memoryIndex = options.memoryIndex.trim()
      ? (options.memoryIndex.endsWith('\n') ? options.memoryIndex : `${options.memoryIndex}\n`)
      : '(Empty memory index)\n'
    messages.push({
      role: 'developer',
      content: `<memory-md>\n${memoryIndex}</memory-md>`,
      visible: false,
      compactionKey: 'memory-md',
      compactionOrder: 1,
    })
  }
  return messages
}

export interface GeneralPurposeAgentContextMessageOptions {
  launchToolName: string
  assignedDirIds: readonly string[]
}

export function createGeneralPurposeAgentContextMessage(options: GeneralPurposeAgentContextMessageOptions): Message {
  const assignedProfiles = options.assignedDirIds.length > 0
    ? options.assignedDirIds.map(dirId => xmlElement('dir_id', dirId)).join('\n')
    : '<scope>not restricted by spawn_agent</scope>'

  return {
    role: 'developer',
    content: `<general_purpose_agent_context>\n${xmlElement('launch_tool', options.launchToolName)}\n<assigned_profiles>\n${assignedProfiles}\n</assigned_profiles>\n</general_purpose_agent_context>`,
    visible: false,
  }
}
