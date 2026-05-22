// type NodeEnv = 'production' | 'development' | 'staging'

export const env = {
  // fix: 不要使用 NODE_ENV 这个字段。
  ENV_TYPE: process.env.ENV_TYPE,
  // 当前账号的token
  ROXY_USER_TOKEN: process.env.ROXY_USER_TOKEN!,

  CONTEXT_MESSAGE_LIMIT: Number(process.env.CONTEXT_MESSAGE_LIMIT) || 15,
  WORKER_CONTEXT_LIMIT: Number(process.env.WORKER_CONTEXT_LIMIT) || 6,
  SYSTEM_LANGUAGE: process.env.SYSTEM_LANGUAGE,
  OPENAPI_SCRIPT_PATH: process.env.OPENAPI_SCRIPT_PATH,
  OPENAPI_SCRIPT_SHA512: process.env.OPENAPI_SCRIPT_SHA512,
  ROXY_API_KEY: process.env.ROXY_API_KEY,
  ROXY_API_HOST: process.env.ROXY_API_HOST,
  PLAYWRIGHT_SCRIPT_PATH: process.env.PLAYWRIGHT_SCRIPT_PATH,
  PLAYWRIGHT_SCRIPT_SHA512: process.env.PLAYWRIGHT_SCRIPT_SHA512,
  CHECKPOINT_DIR: process.env.CHECKPOINT_DIR!,
  ROXY_SERVER_PORT: Number(process.env.ROXY_SERVER_PORT) || 3000,
  ROXY_USER_ID: process.env.ROXY_USER_ID,
  ROXY_WORKSPACE_ID: process.env.ROXY_WORKSPACE_ID,

  DOWNLOADS_DIR: process.env.DOWNLOADS_DIR!,
  DESKTOP_DIR: process.env.DESKTOP_DIR!,
  SKILLS_DIR: process.env.SKILLS_DIR!,

  ROXY_MODE: process.env.ROXY_MODE || '',
  ROXY_SERVER_URL: process.env.ROXY_SERVER_URL!,
  ROXY_SERVER_HEADERS: JSON.parse(process.env.ROXY_SERVER_HEADERS || '{}'),
}

export const aiAgentUrl = env.ENV_TYPE === 'production' ? 'https://roxybrowser.com/llm-proxy' : 'https://apitest.roxybrowser.co/llm-proxy'

console.debug('env: ', env)
