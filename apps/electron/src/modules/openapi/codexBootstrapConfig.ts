import { createAgentPaths, resolveAgentHome } from '@roxy/shared/agent-paths'
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const CODEX_BOOTSTRAP_TIMEOUT = '30000'
const FILE_MODE_CURRENT_USER_ONLY = 0o600
const DIR_MODE_CURRENT_USER_ONLY = 0o700

export interface CodexBootstrapConfig {
  apiKey: string
  workspaceId: string
  apiHost: string
  timeout: string
}

export interface CodexBootstrapConfigInput {
  apiKey?: null | string
  workspaceId?: null | number | string
  apiHost?: null | string
  timeout?: null | number | string
}

interface CodexBootstrapConfigDependencies {
  chmod: typeof chmod
  mkdir: typeof mkdir
  rename: typeof rename
  rm: typeof rm
  writeFile: typeof writeFile
}

interface WriteCodexBootstrapConfigOptions {
  configPath?: string
  dependencies?: CodexBootstrapConfigDependencies
  isProduction?: boolean
}

const defaultDependencies: CodexBootstrapConfigDependencies = {
  chmod,
  mkdir,
  rename,
  rm,
  writeFile,
}

export function getCodexBootstrapConfigPath(isProduction: boolean): string {
  return createAgentPaths(resolveAgentHome(isProduction)).codexOauthConfigFile
}

export function buildCodexBootstrapConfig(input: CodexBootstrapConfigInput): CodexBootstrapConfig | null {
  const apiKey = normalizeRequiredString(input.apiKey)
  const workspaceId = normalizeRequiredString(input.workspaceId)
  const apiHost = normalizeRequiredString(input.apiHost)

  if (!apiKey || !workspaceId || !apiHost) {
    return null
  }

  return {
    apiKey,
    workspaceId,
    apiHost,
    timeout: normalizeRequiredString(input.timeout) ?? CODEX_BOOTSTRAP_TIMEOUT,
  }
}

export async function writeCodexBootstrapConfig(
  input: CodexBootstrapConfigInput,
  options: WriteCodexBootstrapConfigOptions = {},
): Promise<boolean> {
  const config = buildCodexBootstrapConfig(input)
  if (!config) {
    return false
  }

  const dependencies = options.dependencies ?? defaultDependencies
  const configPath = options.configPath ?? getCodexBootstrapConfigPath(Boolean(options.isProduction))
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`

  try {
    await dependencies.mkdir(dirname(configPath), {
      mode: DIR_MODE_CURRENT_USER_ONLY,
      recursive: true,
    })
    await dependencies.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8',
      mode: FILE_MODE_CURRENT_USER_ONLY,
    })
    await dependencies.chmod(tempPath, FILE_MODE_CURRENT_USER_ONLY)
    await dependencies.rename(tempPath, configPath)
    await dependencies.chmod(configPath, FILE_MODE_CURRENT_USER_ONLY)
    return true
  }
  catch (error) {
    await dependencies.rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}

function normalizeRequiredString(value: null | number | string | undefined): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed || null
}
