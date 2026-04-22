import './logger'
import { env } from './config'
import { runAgentMode } from './modes/agent'
import { runIMMode } from './modes/im'
import { runWorkerMode } from './modes/worker'
import { initSensitiveWords } from './sensitiveWords'

// 开发环境：从 words/ 加载敏感词并注入 globalThis.__SENSITIVE_WORDS__（打包后由 build-words 注入，此处不覆盖）
if (env.DEVELOPMENT) {
  initSensitiveWords()
}

type ShutdownFn = () => Promise<void>

function resolveMode(): string {
  // CLI 参数优先
  const arg = process.argv[2]
  if (arg === 'agent' || arg === 'im' || arg === 'worker') {
    return arg
  }
  // 其次读环境变量
  if (env.ROXY_MODE) {
    return env.ROXY_MODE
  }
  // 默认 agent，向后兼容
  return 'agent'
}

async function main() {
  const mode = resolveMode()
  console.log(`[startup] Mode: ${mode}`)

  let shutdown: ShutdownFn

  if (mode === 'agent') {
    shutdown = await runAgentMode()
  }
  else if (mode === 'im') {
    shutdown = await runIMMode()
  }
  else if (mode === 'worker') {
    shutdown = await runWorkerMode()
  }
  else {
    console.error(`[startup] Unknown mode: "${mode}". Valid modes: agent, im, worker`)
    process.exit(1)
  }

  // 在 mode 启动完成后再注册 signal handler，确保 shutdown 函数有效
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
    await shutdown()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...')
    await shutdown()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[startup] Fatal error:', err)
  process.exit(1)
})
