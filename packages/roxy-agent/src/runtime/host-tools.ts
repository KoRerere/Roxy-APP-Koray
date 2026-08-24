import type { ToolDefinition } from 'roxy-agent-runtime'
import { spawnSync } from 'node:child_process'

const RIPGREP_COMMAND = 'rg'
const RIPGREP_DETECTION_TIMEOUT_MS = 2000

let cachedRipgrepAvailable: boolean | undefined

export interface HostToolCapabilities {
  hasRipgrep: boolean
}

export function detectRipgrepAvailable(): boolean {
  const result = spawnSync(RIPGREP_COMMAND, ['--version'], {
    encoding: 'utf8',
    timeout: RIPGREP_DETECTION_TIMEOUT_MS,
    windowsHide: true,
  })
  return result.error === undefined && result.status === 0
}

export function getHostToolCapabilities(): HostToolCapabilities {
  cachedRipgrepAvailable ??= detectRipgrepAvailable()
  return { hasRipgrep: cachedRipgrepAvailable }
}

export function filterBuiltinToolsForHostCapabilities(
  tools: readonly ToolDefinition[],
  capabilities: HostToolCapabilities = getHostToolCapabilities(),
): ToolDefinition[] {
  if (!capabilities.hasRipgrep) {
    return [...tools]
  }
  return tools.filter(tool => tool.descriptor.name !== 'grep')
}
