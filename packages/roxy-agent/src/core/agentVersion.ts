import agentEnvLocalRaw from '../../.env.local?raw'

export interface AgentVersionEnv {
  AI_AGENT_VERSION_DEV: string
  AI_AGENT_VERSION_PROD: string
}

type AgentVersionGlobal = typeof globalThis & {
  __ROXY_AGENT_VERSION_ENV__?: AgentVersionEnv
}

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function parseAgentVersionEnv(raw: string): Partial<AgentVersionEnv> {
  const parsed: Partial<AgentVersionEnv> = {}
  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (key !== 'AI_AGENT_VERSION_DEV' && key !== 'AI_AGENT_VERSION_PROD') {
      continue
    }

    parsed[key] = parseEnvValue(line.slice(separatorIndex + 1))
  }
  return parsed
}

function createAgentVersionEnv(): AgentVersionEnv {
  const parsed = parseAgentVersionEnv(agentEnvLocalRaw)
  const versions = {
    AI_AGENT_VERSION_DEV: parsed.AI_AGENT_VERSION_DEV || process.env.AI_AGENT_VERSION_DEV || '',
    AI_AGENT_VERSION_PROD: parsed.AI_AGENT_VERSION_PROD || process.env.AI_AGENT_VERSION_PROD || '',
  }

  if (!versions.AI_AGENT_VERSION_DEV || !versions.AI_AGENT_VERSION_PROD) {
    throw new Error(
      'Missing AI_AGENT_VERSION_DEV / AI_AGENT_VERSION_PROD in packages/roxy-agent/.env.local.',
    )
  }

  return versions
}

export const agentVersionEnv: AgentVersionEnv = createAgentVersionEnv()

export function installAgentVersionEnv(): AgentVersionEnv {
  const versionGlobal = globalThis as AgentVersionGlobal
  versionGlobal.__ROXY_AGENT_VERSION_ENV__ = agentVersionEnv
  process.env.AI_AGENT_VERSION_DEV = agentVersionEnv.AI_AGENT_VERSION_DEV
  process.env.AI_AGENT_VERSION_PROD = agentVersionEnv.AI_AGENT_VERSION_PROD
  return agentVersionEnv
}

export function getBundledAgentVersion(envType = process.env.ENV_TYPE): string {
  return envType === 'development'
    ? agentVersionEnv.AI_AGENT_VERSION_DEV
    : agentVersionEnv.AI_AGENT_VERSION_PROD
}

installAgentVersionEnv()
