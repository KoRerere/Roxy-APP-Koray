import './core/logger'
import './core/polyfill'
import fixPath from 'fix-path'
import { env } from './config'
import { runAgentMode } from './modes/agent'
import { runIMMode } from './modes/im'
import { runSandboxMode } from './modes/sandbox'
import { runWorkerMode } from './modes/worker'

// 修复系统环境变量
fixPath()

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
  else if (mode === 'sandbox') {
    shutdown = await runSandboxMode()
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
