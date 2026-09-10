import { getBundledAgentVersion } from './core/agentVersion'

function normalizeSystemLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().replaceAll('_', '-').toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized.startsWith('zh')) {
    return 'zh-CN'
  }
  if (normalized.startsWith('en')) {
    return 'en'
  }
  if (normalized.startsWith('ru')) {
    return 'ru'
  }
  return normalized
}

// type NodeEnv = 'production' | 'development' | 'staging'

export const env = {
  // fix: 不要使用 NODE_ENV 这个字段。
  ENV_TYPE: process.env.ENV_TYPE,
  // 当前账号的token
  ROXY_USER_TOKEN: process.env.ROXY_USER_TOKEN!,

  SYSTEM_LANGUAGE: normalizeSystemLanguage(process.env.SYSTEM_LANGUAGE),
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  ROXY_API_KEY: process.env.ROXY_API_KEY,
  ROXY_API_HOST: process.env.ROXY_API_HOST,
  CHECKPOINT_DIR: process.env.CHECKPOINT_DIR!,
  ROXY_SERVER_PORT: Number(process.env.ROXY_SERVER_PORT) || 3000,
  ROXY_USER_ID: process.env.ROXY_USER_ID,
  ROXY_WORKSPACE_ID: process.env.ROXY_WORKSPACE_ID,
  AGENT_SCRIPT_PATH: process.env.AGENT_SCRIPT_PATH!,
  AGENT_ENTRY_SCRIPT: process.env.AGENT_ENTRY_SCRIPT,

  DOWNLOADS_DIR: process.env.DOWNLOADS_DIR!,
  DESKTOP_DIR: process.env.DESKTOP_DIR!,
  SKILLS_DIR: process.env.SKILLS_DIR!,

  ROXY_SERVER_URL: process.env.ROXY_SERVER_URL!,

  AGENT_WORK_DIR: process.env.AGENT_WORK_DIR!,
  ROXY_SERVER_HEADERS: JSON.parse(process.env.ROXY_SERVER_HEADERS || '{}'),

  AI_AGENT_VERSION: getBundledAgentVersion(process.env.ENV_TYPE),
}

export const aiAgentUrl = `${env.ROXY_SERVER_URL}/llm-proxy`
// Responses API is exposed by llm-proxy under its OpenAI-compatible v1 route.
// Keep aiAgentUrl unchanged for the generated agent API client.
export const aiAgentResponsesUrl = `${aiAgentUrl}/v1`

export const aiAgentToken = `${env.ROXY_API_KEY}:${env.ROXY_USER_TOKEN}`
