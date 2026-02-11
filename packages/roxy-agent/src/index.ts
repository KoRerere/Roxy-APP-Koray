import { abortAll } from './agent/utils/abortRegistry'
import { env } from './config'
import { closeDatabase } from './database/context'
import { closeDatabase as closeConversationsDatabase } from './database/conversations'
import { initSensitiveWords } from './sensitiveWords'
import { startServer } from './server'

// 开发环境：从 words/ 加载敏感词并注入 globalThis.__SENSITIVE_WORDS__（打包后由 build-words 注入，此处不覆盖）
if (env.DEVELOPMENT) {
  initSensitiveWords()
  console.log('globalThis.__SENSITIVE_WORDS__', globalThis.__SENSITIVE_WORDS__)
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  abortAll()
  closeDatabase()
  closeConversationsDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  abortAll()
  closeDatabase()
  closeConversationsDatabase()
  process.exit(0)
})

startServer()

// // 全局异常处理 - 除了手动关闭外的各种异常情况都不让进程退出
// process.on('uncaughtException', (error) => {
//   console.error('❌ Uncaught Exception:', error);
//   // 不退出进程，只打印错误
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
//   // 不退出进程，只打印错误
// });

// // 处理其他可能的异步错误
// process.on('warning', (warning) => {
//   console.warn('⚠️  Warning:', warning);
// });
