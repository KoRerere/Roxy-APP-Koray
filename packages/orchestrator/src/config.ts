export const env = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_BALANCE: Number(process.env.LLM_BALANCE) || 0,
  SILICONFLOW_THINKING_BUDGET: process.env.SILICONFLOW_THINKING_BUDGET,
  MAX_TURNS: Number(process.env.MAX_TURNS) || 20,
  CONTEXT_MESSAGE_LIMIT: Number(process.env.CONTEXT_MESSAGE_LIMIT) || 15,
  WORKER_CONTEXT_LIMIT: Number(process.env.WORKER_CONTEXT_LIMIT) || 6,
  SYSTEM_LANGUAGE: process.env.SYSTEM_LANGUAGE,
  OPENAPI_SCRIPT_PATH: process.env.OPENAPI_SCRIPT_PATH,
  ROXY_API_KEY: process.env.ROXY_API_KEY,
  ROXY_API_HOST: process.env.ROXY_API_HOST,
  PLAYWRIGHT_SCRIPT_PATH: process.env.PLAYWRIGHT_SCRIPT_PATH,
  CHECKPOINT_DIR: process.env.CHECKPOINT_DIR,
  ROXY_SERVER_PORT: Number(process.env.ROXY_SERVER_PORT) || 3000,
  ROXY_USER_ID: process.env.ROXY_USER_ID,
  ROXY_WORKSPACE_ID: process.env.ROXY_WORKSPACE_ID,
  MAX_MESSAGES_BEFORE_SUMMARY: Number(process.env.MAX_MESSAGES_BEFORE_SUMMARY) || 20,
  KEEP_RECENT_MESSAGES: Number(process.env.KEEP_RECENT_MESSAGES) || 6,
  SIMPLE_SYNTHESIS_CONTEXT_LIMIT: Number(process.env.SIMPLE_SYNTHESIS_CONTEXT_LIMIT) || 10,

  SITE_URL: process.env.SITE_URL,
  SITE_NAME: process.env.SITE_NAME,
}

console.log('env: ', env)

// 监听父进程的消息
process.parentPort?.on('message', (message: any) => {
  if (message.event === 'change_balance') {
    env.LLM_BALANCE = Number(message.data.balance)
  }
})
