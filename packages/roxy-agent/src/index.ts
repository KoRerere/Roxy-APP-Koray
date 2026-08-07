import './core/storage/bootstrap'
import './core/logger'
import './core/polyfill'
import fixPath from 'fix-path'
import { env } from './config'
import { runAgentMode } from './modes/agent'
import { runSandboxMode } from './modes/sandbox'
import { runWorkerMode } from './modes/worker'

// 修复系统环境变量
fixPath()

type ShutdownFn = () => Promise<void>
type RuntimeMode = 'agent' | 'worker' | 'sandbox'

function resolveMode(): RuntimeMode {
  // CLI 参数优先（sandbox 也支持关键字模式，此时 argv[2]==='sandbox'，脚本路径在 argv[3]）
  const arg = process.argv[2]
  if (arg === 'agent' || arg === 'worker' || arg === 'sandbox') {
    return arg
  }
  // 其次读环境变量
  if (env.ROXY_MODE === 'agent' || env.ROXY_MODE === 'worker' || env.ROXY_MODE === 'sandbox') {
    return env.ROXY_MODE
  }
  // 默认 agent，向后兼容
  return 'agent'
}

async function main() {
  const mode = resolveMode()
  console.log(`[startup] Mode: ${mode}`)

  let shutdown: ShutdownFn

  switch (mode) {
    case 'agent':
      shutdown = await runAgentMode()
      break
    case 'worker':
      shutdown = await runWorkerMode()
      break
    case 'sandbox':
      shutdown = await runSandboxMode()
      break
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
