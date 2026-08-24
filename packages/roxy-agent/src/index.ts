import './core/polyfill'
import fixPath from 'fix-path'
import { initializeLogger, shutdownLogger } from './core/logger'
import { ensureBundledSystemSkills } from './core/systemSkillsBootstrap'

type ShutdownFn = () => Promise<void>
type RuntimeMode = 'agent' | 'sandbox'

function resolveMode(): RuntimeMode {
  // CLI 参数优先（sandbox 也支持关键字模式，此时 argv[2]==='sandbox'，脚本路径在 argv[3]）
  const arg = process.argv[2]
  if (arg === 'agent' || arg === 'sandbox') {
    return arg
  }
  // 其次读环境变量
  if (process.env.ROXY_MODE === 'agent' || process.env.ROXY_MODE === 'sandbox') {
    return process.env.ROXY_MODE
  }
  // 默认 agent，向后兼容
  return 'agent'
}

async function main() {
  fixPath()
  const mode = resolveMode()
  initializeLogger(mode, process.env.SANDBOX_HOST_GENERATION)
  console.log(`[startup] Mode: ${mode}`)

  let shutdown: ShutdownFn
  if (mode === 'agent') {
    // Run migration before loading agent.ts, whose static dependencies include database modules.
    const { runStorageMigration } = await import('./core/storage/migrate')
    runStorageMigration()
    await ensureBundledSystemSkills()
    const { runAgentMode } = await import('./modes/agent')
    shutdown = await runAgentMode()
  }
  else {
    const { runSandboxMode } = await import('./modes/sandbox')
    shutdown = await runSandboxMode()
  }

  // 在 mode 启动完成后再注册 signal handler，确保 shutdown 函数有效
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
    try {
      await shutdown()
    }
    finally {
      shutdownLogger()
    }
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...')
    try {
      await shutdown()
    }
    finally {
      shutdownLogger()
    }
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[startup] Fatal error:', err)
  shutdownLogger()
  process.exit(1)
})
